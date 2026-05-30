"""Run a VGGT-family model over a set of frames and normalize the output.

Two backends, selected by a flag (no code change to swap):

  * ``omega`` — VGGT-Omega-1B-512, gated (https://huggingface.co/facebook/VGGT-Omega).
                Load the downloaded ``vggt_omega_1b_512.pt`` via --checkpoint.
                Official API: VGGTOmega() + encoding_to_camera + depth (no point head).
  * ``vggt``  — base VGGT-1B, ungated (https://huggingface.co/facebook/VGGT-1B).
                Useful fallback; has a point head (`world_points`).

Both give, per frame: a camera pose encoding + a dense depth map with
confidence. We decode cameras, unproject depth to world points (ourselves, so we
don't depend on each repo's geometry-util names), color from the input images,
confidence-filter, and return a backend-agnostic ``Reconstruction``.

torch + the upstream model packages are imported lazily inside functions so the
rest of the package (frames, export) stays importable on a CPU-only Mac.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class Reconstruction:
    points: np.ndarray        # (N, 3) float32 world coordinates
    colors: np.ndarray        # (N, 3) uint8 RGB
    extrinsics: np.ndarray    # (S, 4, 4) float32 world-to-camera (OpenCV)
    intrinsics: np.ndarray    # (S, 3, 3) float32
    image_size: tuple[int, int]  # (H, W) the model ran at


# --------------------------------------------------------------------------- #
# model + preprocessing
# --------------------------------------------------------------------------- #
def _load_model(backend: str, checkpoint: str | None, device: str):
    import torch

    if backend == "omega":
        from vggt_omega.models import VGGTOmega  # type: ignore

        if not checkpoint:
            raise ValueError(
                "backend 'omega' needs --checkpoint to vggt_omega_1b_512.pt "
                "(download it from facebook/VGGT-Omega)."
            )
        model = VGGTOmega().to(device).eval()
        state = torch.load(checkpoint, map_location="cpu")
        if isinstance(state, dict):
            state = state.get("model", state.get("state_dict", state))
        model.load_state_dict(state)
        return model

    # backend == "vggt": base model loads its weights from the Hub directly.
    from vggt.models.vggt import VGGT  # type: ignore

    return VGGT.from_pretrained(checkpoint or "facebook/VGGT-1B").to(device).eval()


def _load_images(backend: str, image_paths: list[str], resolution: int, device: str):
    """Use the matching repo's preprocessing so inputs match training."""
    if backend == "omega":
        from vggt_omega.utils.load_fn import load_and_preprocess_images  # type: ignore
    else:
        from vggt.utils.load_fn import load_and_preprocess_images  # type: ignore

    try:
        images = load_and_preprocess_images(image_paths, image_resolution=resolution)
    except TypeError:
        images = load_and_preprocess_images(image_paths)  # older signature
    return images.to(device)  # (S, 3, H, W)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _np(x):
    return x.float().cpu().numpy() if hasattr(x, "detach") else np.asarray(x)


def _drop_batch(a: np.ndarray, want_ndim: int) -> np.ndarray:
    """Strip a leading singleton batch dim if present (we always run S>>1)."""
    if a.ndim == want_ndim + 1 and a.shape[0] == 1:
        return a[0]
    return a


def _to_4x4(extr: np.ndarray) -> np.ndarray:
    if extr.shape[-2:] == (4, 4):
        return extr
    S = extr.shape[0]
    out = np.tile(np.eye(4, dtype=np.float64), (S, 1, 1))
    out[:, :3, :4] = extr
    return out


def _decode_cameras(backend: str, pose_enc, hw, preds: dict):
    """Return (S,4,4) world-to-camera extrinsics and (S,3,3) intrinsics."""
    import torch

    # Some checkpoints expose extrinsic/intrinsic directly.
    if "extrinsic" in preds and "intrinsic" in preds:
        extr = _drop_batch(_np(preds["extrinsic"]), 3)
        intr = _drop_batch(_np(preds["intrinsic"]), 3)
        return _to_4x4(extr.astype(np.float64)), intr.astype(np.float64)

    if backend == "omega":
        from vggt_omega.utils.pose_enc import encoding_to_camera  # type: ignore

        extr, intr = encoding_to_camera(pose_enc, hw)
    else:
        from vggt.utils.pose_enc import pose_encoding_to_extri_intri  # type: ignore

        extr, intr = pose_encoding_to_extri_intri(pose_enc, hw)

    extr = _drop_batch(_np(extr), 3).astype(np.float64)
    intr = _drop_batch(_np(intr), 3).astype(np.float64)
    return _to_4x4(extr), intr


def _unproject(depth: np.ndarray, extr: np.ndarray, intr: np.ndarray):
    """Depth + cameras -> world point map. Plain pinhole math, version-agnostic.

    depth (S,H,W), extr (S,4,4) world-to-cam, intr (S,3,3). Returns (S,H,W,3).
    """
    S, H, W = depth.shape
    uu, vv = np.meshgrid(np.arange(W), np.arange(H))           # (H,W)
    ones = np.ones_like(uu)
    pix = np.stack([uu, vv, ones], axis=-1).reshape(-1, 3).T   # (3, H*W)

    world = np.empty((S, H * W, 3), dtype=np.float32)
    for s in range(S):
        Kinv = np.linalg.inv(intr[s])
        dirs = Kinv @ pix                                      # (3, N), z-normalized to 1
        cam = dirs * depth[s].reshape(-1)[None, :]             # (3, N), scaled by depth
        R, t = extr[s][:3, :3], extr[s][:3, 3]
        world[s] = (R.T @ (cam - t[:, None])).T                # X_world = R^T (X_cam - t)
    return world.reshape(S, H, W, 3)


def _clean_points(pts, cols, crop_pct: float = 1.0, knn: int = 16, std_ratio: float = 2.0):
    """Drop floating outliers: a gentle percentile bbox crop, then statistical
    (k-NN) outlier removal — the speckle that makes the cloud look noisy."""
    n0 = len(pts)

    # 1) crop the far stragglers that also inflate the scene scale.
    lo, hi = np.percentile(pts, [crop_pct, 100 - crop_pct], axis=0)
    inside = np.all((pts >= lo) & (pts <= hi), axis=1)
    pts, cols = pts[inside], cols[inside]

    # 2) statistical outlier removal (needs scipy; skip gracefully if absent).
    try:
        from scipy.spatial import cKDTree

        tree = cKDTree(pts)
        d, _ = tree.query(pts, k=min(knn, len(pts)))
        mean_d = d[:, 1:].mean(axis=1)                      # exclude self (dist 0)
        thresh = mean_d.mean() + std_ratio * mean_d.std()
        keep = mean_d <= thresh
        pts, cols = pts[keep], cols[keep]
    except Exception as e:  # pragma: no cover
        print(f"[reconstruct] outlier removal skipped ({e})")

    print(f"[reconstruct] cleaned {n0:,} -> {len(pts):,} points")
    return pts, cols


def _voxel_downsample(pts, cols, size: float):
    """Merge points into a voxel grid (one averaged point per cell). Collapses the
    redundant per-frame depth 'sheets' into a single crisp surface."""
    n0 = len(pts)
    keys = np.floor(pts / size).astype(np.int64)
    _, inv = np.unique(keys, axis=0, return_inverse=True)
    n = inv.max() + 1
    counts = np.bincount(inv)[:, None]
    psum = np.zeros((n, 3)); np.add.at(psum, inv, pts)
    csum = np.zeros((n, 3)); np.add.at(csum, inv, cols.astype(np.float64))
    print(f"[reconstruct] voxel-fused {n0:,} -> {n:,} points (voxel={size:.5f})")
    return (psum / counts).astype(np.float32), (csum / counts).astype(np.uint8)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #
def reconstruct(
    image_paths: list[str],
    backend: str = "omega",
    checkpoint: str | None = None,
    resolution: int = 512,
    conf_percentile: float = 50.0,
    device: str | None = None,
    viz_dir: str | None = None,
    clean: bool = True,
    voxel: float | None = None,
    nerfstudio_dir: str | None = None,
    mask_people: bool = False,
    people_ref: str | int | None = None,
) -> Reconstruction:
    """Run inference and return a normalized, confidence-filtered point cloud."""
    import torch

    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[reconstruct] backend={backend} device={device} frames={len(image_paths)}")

    model = _load_model(backend, checkpoint, device)
    images = _load_images(backend, image_paths, resolution, device)  # (S,3,H,W)

    amp_dtype = torch.bfloat16 if device == "cuda" else torch.float32
    with torch.inference_mode():
        with torch.autocast(device_type=("cuda" if device == "cuda" else "cpu"), dtype=amp_dtype):
            preds = model(images)

    # Colors come from the (possibly resized) images the model reports back.
    imgs = _drop_batch(_np(preds["images"]) if "images" in preds else _np(images), 4)
    S, _, H, W = imgs.shape
    rgb = (np.clip(np.transpose(imgs, (0, 2, 3, 1)), 0, 1) * 255).astype(np.uint8)  # (S,H,W,3)

    extr, intr = _decode_cameras(backend, preds["pose_enc"], (H, W), preds)

    # World points: base VGGT may provide them; otherwise unproject depth.
    # Keep the per-frame depth/conf maps (S,H,W) around for diagnostics.
    depth_map = None
    if backend != "omega" and "world_points" in preds:
        world = _drop_batch(_np(preds["world_points"]), 4)                # (S,H,W,3)
        conf_map = _drop_batch(_np(preds["world_points_conf"]), 3) if "world_points_conf" in preds else None
    else:
        # Omega depth comes back as (1, S, H, W, 1) — squeeze batch + channel
        # singletons down to (S, H, W). Safe here because S >> 1.
        depth_map = np.squeeze(_np(preds["depth"]))
        if depth_map.ndim == 4:                   # any non-singleton extra dim left
            depth_map = depth_map[..., 0]
        world = _unproject(depth_map, extr, intr)
        conf_map = np.squeeze(_np(preds["depth_conf"])) if "depth_conf" in preds else None

    # Person masks (255 keep / 0 person), computed once and reused for BOTH the
    # point cloud and the nerfstudio loss masks.
    #   mask_people           -> people removed from EVERY frame (clean empty scene)
    #   people_ref=N / 'auto' -> people kept in ONE frame, masked elsewhere, so the
    #                            crowd appears as a sharp "frozen instant" in the 3D
    #                            scene (single-view supervised -> no multi-view blur).
    keep_masks = None
    if mask_people or people_ref is not None:
        from .masks import person_keep_masks
        keep_masks = person_keep_masks(rgb)              # (S,H,W)
        if people_ref is not None:
            if str(people_ref) == "auto":
                counts = [(keep_masks[i] == 0).sum() for i in range(len(keep_masks))]
                ref = int(np.argmax(counts))             # frame with the most people
            else:
                ref = int(people_ref) % len(keep_masks)
            keep_masks[ref] = 255                         # keep people in this one frame
            print(f"[masks] FROZEN-INSTANT mode: people kept only from frame {ref}, "
                  f"masked in the other {len(keep_masks) - 1} frames")

    pts = world.reshape(-1, 3)
    cols = rgb.reshape(-1, 3)
    keep = np.isfinite(pts).all(axis=1)
    if conf_map is not None:
        keep &= conf_map.reshape(-1) >= np.percentile(conf_map, conf_percentile)
    if keep_masks is not None:
        keep &= keep_masks.reshape(-1) > 0               # drop person pixels from the cloud
    pts, cols = pts[keep], cols[keep]

    if clean and len(pts) > 100:
        pts, cols = _clean_points(pts, cols)

    if voxel and len(pts) > 100:
        diag = float(np.linalg.norm(pts.max(0) - pts.min(0))) or 1.0
        pts, cols = _voxel_downsample(pts, cols, voxel * diag)

    if viz_dir:
        from .diagnostics import dump
        dump(viz_dir, rgb=rgb, depth=depth_map, conf=conf_map, extr=extr, intr=intr,
             points=pts, colors=cols, conf_percentile=conf_percentile)

    if nerfstudio_dir:
        from .export_nerfstudio import write as write_ns
        write_ns(nerfstudio_dir, rgb=rgb, extrinsics=extr, intrinsics=intr,
                 points=pts, colors=cols, masks=keep_masks)

    print(f"[reconstruct] {len(pts):,} points, {len(extr)} cameras, image {H}x{W}")
    return Reconstruction(
        pts.astype(np.float32), cols.astype(np.uint8),
        extr.astype(np.float32), intr.astype(np.float32), (H, W),
    )
