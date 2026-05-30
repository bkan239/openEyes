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


def reconstruct(model, image_dir, out_dir, device: str = "cuda"):
    """images -> Gaussians + poses -> fly-through video (+ .ply). Returns out dir."""
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

    t = time.time()
    with torch.inference_mode():
        gaussians, pose = model.inference((imgs + 1) * 0.5)   # forward pass
    extrinsic, intrinsic = pose["extrinsic"], pose["intrinsic"]

    # Render a fly-through interpolated through the recovered cameras.
    save_interpolated_video(extrinsic, intrinsic, b, h, w, gaussians, str(out_dir), model.decoder)

    # Best-effort export of the raw Gaussians for SuperSplat / interactive viewing.
    try:
        from src.misc.image_io import export_ply  # name may differ; optional
        export_ply(gaussians, str(out_dir / "gaussians.ply"))
    except Exception:
        pass

    print(f"[anysplat] {k} imgs -> {out_dir} in {time.time() - t:.1f}s")
    return out_dir
