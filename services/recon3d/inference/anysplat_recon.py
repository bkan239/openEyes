"""AnySplat feed-forward reconstruction: a folder of images -> 3D Gaussians +
camera poses in ONE forward pass -> rendered fly-through video.

Runs in the isolated `.venv-anysplat` (torch 2.2/cu121). The model load is kept
separate from the per-batch work so `serve.py` can keep the model resident and
reconstruct each new batch in seconds.

NOTE: import paths / call signatures below follow the AnySplat README. If the
cloned repo differs, the ground truth is `AnySplat/demo_gradio.py` — adjust the
three marked lines to match it.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

# Cache HF weights (AnySplat + its VGGT-1B backbone, ~10 GB) on the PERSISTENT
# /workspace volume, not the small ephemeral container disk (which runs out and
# is wiped on pod restart). Override by exporting HF_HOME yourself.
if Path("/workspace").is_dir():
    os.environ.setdefault("HF_HOME", "/workspace/hf-cache")

HERE = Path(__file__).resolve().parent
ANYSPLAT = HERE / "AnySplat"
if str(ANYSPLAT) not in sys.path:
    sys.path.insert(0, str(ANYSPLAT))   # the repo exposes a top-level `src` package

IMG_EXTS = (".jpg", ".jpeg", ".png")


def _convert_heic(image_dir: Path) -> None:
    """iPhone HEIC/HEIF -> JPG (idempotent; no-op if none)."""
    heics = [p for p in image_dir.iterdir() if p.suffix.lower() in (".heic", ".heif")]
    if not heics:
        return
    import pillow_heif
    from PIL import Image
    pillow_heif.register_heif_opener()
    n = 0
    for p in heics:
        jpg = p.with_suffix(".jpg")
        if not jpg.exists():
            Image.open(p).convert("RGB").save(jpg, "JPEG", quality=95)
            n += 1
    print(f"[anysplat] converted {n} HEIC -> JPG")


def _list_images(image_dir: Path) -> list[str]:
    paths: set[str] = set()
    for e in IMG_EXTS:
        paths.update(str(p) for p in image_dir.glob(f"*{e}"))
        paths.update(str(p) for p in image_dir.glob(f"*{e.upper()}"))
    return sorted(paths)


def load_model(device: str = "cuda"):
    """Load AnySplat once (weights auto-download from HF: lhjiang/anysplat)."""
    import torch
    from src.model.model.anysplat import AnySplat            # <-- verify vs demo_gradio.py

    print("[anysplat] loading model (lhjiang/anysplat)...")
    model = AnySplat.from_pretrained("lhjiang/anysplat")
    model = model.to("cuda" if torch.cuda.is_available() else device).eval()
    for p in model.parameters():
        p.requires_grad = False
    print("[anysplat] model ready")
    return model


def _trajectories(extrinsic, intrinsic, multi: bool):
    """Trajectory variants built from the predicted input poses.

    save_interpolated_video interpolates THROUGH whatever pose sequence we pass
    (with `t` = interpolated frames between consecutive views), so different
    orderings/speeds give visibly different fly-throughs. All are honest — the
    camera only ever passes through/among the witnessed viewpoints.
    """
    import torch

    ax = 1 if extrinsic.dim() == 4 else 0          # the "view" axis
    variants = [("flythrough", extrinsic, intrinsic, 12),   # forward (canonical)
                ("slow", extrinsic, intrinsic, 28)]         # same path, slower/smoother
    if multi:
        try:
            er, ir = extrinsic.flip(ax), intrinsic.flip(ax)
            variants.append(("reverse", er, ir, 12))
            variants.append(("pingpong",
                             torch.cat([extrinsic, er], ax),
                             torch.cat([intrinsic, ir], ax), 10))
        except Exception as e:
            print(f"[anysplat] reverse/pingpong variants skipped ({e})")
    return variants


def reconstruct(model, image_dir, out_dir, device: str = "cuda", trajectories: bool = True):
    """images -> Gaussians + poses -> RGB fly-through video(s). Returns list of mp4 paths.

    Renders the **RGB** video (rgb.mp4), not the depth map, and — when
    ``trajectories`` is set — several trajectory variants (forward / slow /
    reverse / ping-pong), each as ``<out_dir>/<name>.mp4``. `flythrough.mp4` is
    the canonical forward one.
    """
    import shutil

    import torch
    from src.utils.image import process_image                # <-- verify vs demo_gradio.py
    from src.misc.image_io import save_interpolated_video    # <-- verify vs demo_gradio.py

    image_dir = Path(image_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    _convert_heic(image_dir)
    paths = _list_images(image_dir)
    if not paths:
        raise SystemExit(f"[anysplat] no images in {image_dir}")

    # [K,3,H,W] -> [1,K,3,H,W]; AnySplat's process_image yields [-1,1] @ 448px.
    imgs = torch.stack([process_image(p) for p in paths], dim=0).unsqueeze(0)
    imgs = imgs.to("cuda" if torch.cuda.is_available() else device)
    b, k, _, h, w = imgs.shape

    t0 = time.time()
    with torch.inference_mode():
        gaussians, pose = model.inference((imgs + 1) * 0.5)   # ONE forward pass
    extrinsic, intrinsic = pose["extrinsic"], pose["intrinsic"]
    print(f"[anysplat] inference: {k} imgs in {time.time() - t0:.1f}s; rendering trajectories...")

    videos: list[Path] = []
    for name, extr, intr, t in _trajectories(extrinsic, intrinsic, trajectories):
        sub = out_dir / f"_{name}"
        sub.mkdir(parents=True, exist_ok=True)
        try:
            # writes rgb.mp4 (color) + depth.mp4 into `sub`
            save_interpolated_video(extr, intr, b, h, w, gaussians, str(sub), model.decoder, t=t)
            rgb = sub / "rgb.mp4"
            if rgb.exists():
                dst = out_dir / f"{name}.mp4"      # the RGB render, not depth
                shutil.copy(rgb, dst)
                videos.append(dst)
                print(f"[anysplat]   ✓ {name}.mp4")
            else:
                print(f"[anysplat]   ✗ {name}: no rgb.mp4 in {sub}")
        except Exception as e:
            print(f"[anysplat]   ✗ {name} failed: {e}")

    # Best-effort raw-Gaussian export for SuperSplat / interactive viewing.
    try:
        from src.misc.image_io import export_ply  # name may differ; optional
        export_ply(gaussians, str(out_dir / "gaussians.ply"))
    except Exception:
        pass

    print(f"[anysplat] {k} imgs -> {len(videos)} videos in {time.time() - t0:.1f}s -> {out_dir}")
    return videos
