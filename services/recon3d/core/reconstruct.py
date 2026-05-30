"""Run a VGGT-family model over a set of frames and normalize the output.

Two backends, selected by a flag (no code change to swap):

  * ``vggt``  — base VGGT-1B, ungated (https://huggingface.co/facebook/VGGT-1B).
                Used to prove the pipeline while VGGT-Omega access is pending.
  * ``omega`` — VGGT-Omega-1B-512, gated (https://huggingface.co/facebook/VGGT-Omega).
                Load the downloaded checkpoint via --checkpoint.

Both produce, per frame, camera extrinsics/intrinsics + a dense point map with
confidence. We flatten those into one colored point cloud plus a list of camera
poses — a backend-agnostic ``Reconstruction`` the exporter can consume.

This module imports torch and the upstream model packages, so it only runs on
the GPU pod. Keep heavy imports inside the functions so the rest of the package
(frames, export) stays importable on the Mac.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class Reconstruction:
    points: np.ndarray        # (N, 3) float32 world coordinates
    colors: np.ndarray        # (N, 3) uint8 RGB
    extrinsics: np.ndarray    # (S, 4, 4) float32 camera-to-world (or world-to-cam; see export)
    intrinsics: np.ndarray    # (S, 3, 3) float32
    image_size: tuple[int, int]  # (H, W) the model ran at


def _load_model(backend: str, checkpoint: str | None, device: str):
    import torch

    if backend == "omega":
        # See https://github.com/facebookresearch/vggt-omega
        from vggt_omega.models import VGGTOmega  # type: ignore

        model = VGGTOmega().to(device).eval()
        if not checkpoint:
            raise ValueError("backend 'omega' requires --checkpoint to a downloaded .pt")
        state = torch.load(checkpoint, map_location="cpu")
        # Some releases nest the weights under a key.
        state = state.get("model", state) if isinstance(state, dict) else state
        model.load_state_dict(state)
        return model

    # backend == "vggt": base model, loads weights from the Hub directly.
    from vggt.models.vggt import VGGT  # type: ignore

    name = checkpoint or "facebook/VGGT-1B"
    model = VGGT.from_pretrained(name).to(device).eval()
    return model


def _load_images(image_paths: list[str], resolution: int, device: str):
    """Use the upstream preprocessing so inputs match training."""
    try:
        from vggt.utils.load_fn import load_and_preprocess_images  # type: ignore
    except Exception:  # pragma: no cover - omega-only environments
        from vggt_omega.utils.load_fn import load_and_preprocess_images  # type: ignore

    try:
        images = load_and_preprocess_images(image_paths, image_resolution=resolution)
    except TypeError:
        # Older signature without the resolution kwarg.
        images = load_and_preprocess_images(image_paths)
    return images.to(device)


def reconstruct(
    image_paths: list[str],
    backend: str = "vggt",
    checkpoint: str | None = None,
    resolution: int = 512,
    conf_percentile: float = 50.0,
    device: str | None = None,
) -> Reconstruction:
    """Run inference and return a normalized, confidence-filtered point cloud."""
    import torch

    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[reconstruct] backend={backend} device={device} frames={len(image_paths)}")

    model = _load_model(backend, checkpoint, device)
    images = _load_images(image_paths, resolution, device)  # (S, 3, H, W)
    if images.ndim == 4:
        images = images[None]  # add batch -> (1, S, 3, H, W)

    autocast_dtype = torch.bfloat16 if device == "cuda" else torch.float32
    with torch.inference_mode():
        with torch.autocast(device_type="cuda" if device == "cuda" else "cpu", dtype=autocast_dtype):
            preds = model(images)

    preds = {k: (v.float().cpu().numpy() if hasattr(v, "detach") else v) for k, v in preds.items()}

    # ---- point map + confidence -------------------------------------------------
    # Prefer a precomputed world point map; otherwise unproject depth.
    if "world_points" in preds:
        world = preds["world_points"][0]            # (S, H, W, 3)
        conf = preds.get("world_points_conf", [None])[0]
    else:
        world, conf = _unproject(preds)

    imgs = preds["images"][0]                        # (S, 3, H, W) in [0,1]
    S, _, H, W = imgs.shape
    rgb = (np.transpose(imgs, (0, 2, 3, 1)) * 255).astype(np.uint8)  # (S,H,W,3)

    pts = world.reshape(-1, 3)
    cols = rgb.reshape(-1, 3)
    if conf is not None:
        conf = conf.reshape(-1)
        thresh = np.percentile(conf, conf_percentile)
        keep = conf >= thresh
        pts, cols = pts[keep], cols[keep]

    # Drop NaNs/infs.
    finite = np.isfinite(pts).all(axis=1)
    pts, cols = pts[finite], cols[finite]

    extr, intr = _cameras(preds, (H, W))
    print(f"[reconstruct] {len(pts):,} points, {len(extr)} cameras")
    return Reconstruction(pts.astype(np.float32), cols.astype(np.uint8), extr, intr, (H, W))


def _cameras(preds: dict, image_size: tuple[int, int]):
    """Recover (S,4,4) extrinsics and (S,3,3) intrinsics from the predictions."""
    if "extrinsic" in preds and "intrinsic" in preds:
        return preds["extrinsic"][0], preds["intrinsic"][0]
    # Decode from pose encoding (base VGGT path).
    try:
        import torch
        from vggt.utils.pose_enc import pose_encoding_to_extri_intri  # type: ignore

        pose_enc = torch.from_numpy(preds["pose_enc"])
        extr, intr = pose_encoding_to_extri_intri(pose_enc, image_size)
        return extr[0].numpy(), intr[0].numpy()
    except Exception as e:  # pragma: no cover
        print(f"[reconstruct] could not decode cameras ({e}); returning identities")
        S = preds["images"].shape[1]
        return np.tile(np.eye(4), (S, 1, 1)), np.tile(np.eye(3), (S, 1, 1))


def _unproject(preds: dict):
    """Fallback: build a world point map from depth + cameras."""
    from vggt.utils.geometry import unproject_depth_map_to_point_map  # type: ignore

    depth = preds["depth"][0]            # (S, H, W, 1) or (S, H, W)
    extr, intr = _cameras(preds, depth.shape[1:3])
    world = unproject_depth_map_to_point_map(depth, extr, intr)
    conf = preds.get("depth_conf", [None])[0]
    return world, conf
