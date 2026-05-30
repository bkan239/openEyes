#!/usr/bin/env python3
"""Offline reconstruction CLI — the guaranteed demo asset.

clips -> frames -> VGGT(-Omega) -> out/scene.glb

Run on a CUDA GPU (RunPod Pod):

    python run.py --clips-dir data/clips --out out --backend vggt
    # once VGGT-Omega access is granted + checkpoint downloaded:
    python run.py --clips-dir data/clips --out out \
        --backend omega --checkpoint checkpoints/vggt-omega-1b-512.pt
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path


def _convert_heic(images_dir: str) -> None:
    """Convert any .heic/.heif in the folder to .jpg (idempotent). No-op if there
    are none, so JPG/PNG folders just pass through untouched."""
    d = Path(images_dir)
    heics = [p for p in d.iterdir() if p.suffix.lower() in (".heic", ".heif")]
    if not heics:
        return
    try:
        import pillow_heif
        from PIL import Image
        pillow_heif.register_heif_opener()
        n = 0
        for p in heics:
            jpg = p.with_suffix(".jpg")
            if not jpg.exists():
                Image.open(p).convert("RGB").save(jpg, "JPEG", quality=95)
                n += 1
        print(f"[run] converted {n} HEIC -> JPG in {images_dir}")
    except Exception as e:
        raise SystemExit(
            f"Found {len(heics)} HEIC files but couldn't convert them ({e}). "
            f"Install pillow-heif:  pip install pillow-heif"
        )


def main() -> None:
    ap = argparse.ArgumentParser(description="OpenEyes 3D reconstruction (VGGT / VGGT-Omega)")
    ap.add_argument("--clips-dir", default="data/clips", help="folder of .mp4 clips")
    ap.add_argument("--clip", action="append", default=None,
                    help="specific clip path(s); repeatable. Use ONE clip for the most "
                         "reliable result (dense overlap). Overrides --clips-dir.")
    ap.add_argument("--images-dir", default=None,
                    help="folder of images to reconstruct directly (skips video frame "
                         "extraction). Use to VERIFY the pipeline on clean/static inputs, "
                         "e.g. the vggt-omega example images.")
    ap.add_argument("--start", type=float, default=None,
                    help="trim: start time in seconds (sample only from here)")
    ap.add_argument("--end", type=float, default=None,
                    help="trim: end time in seconds (sample only up to here)")
    ap.add_argument("--out", default="out", help="output folder")
    ap.add_argument("--backend", choices=["vggt", "omega"], default="omega")
    ap.add_argument("--checkpoint", default=None,
                    help="omega: path to vggt_omega_1b_512.pt; vggt: HF repo id (default facebook/VGGT-1B)")
    ap.add_argument("--resolution", type=int, default=512)
    ap.add_argument("--max-frames", type=int, default=60)
    ap.add_argument("--conf-percentile", type=float, default=50.0,
                    help="drop points below this confidence percentile")
    ap.add_argument("--no-cameras", action="store_true", help="omit camera frustums in GLB")
    ap.add_argument("--no-viz", action="store_true",
                    help="skip the diagnostic visualizations in out/viz/")
    ap.add_argument("--no-clean", action="store_true",
                    help="skip outlier removal (keep raw point cloud)")
    ap.add_argument("--voxel", type=float, default=None,
                    help="voxel-fuse the cloud; size as a fraction of the scene diagonal "
                         "(e.g. 0.004). Merges stacked per-frame depth sheets into one "
                         "crisp surface. Off by default.")
    ap.add_argument("--nerfstudio", action="store_true",
                    help="also export a nerfstudio dataset to <out>/nerfstudio for "
                         "Gaussian Splatting (ns-train splatfacto --data <out>/nerfstudio)")
    ap.add_argument("--mask-people", action="store_true",
                    help="segment people and mask them in EVERY frame -> clean empty scene "
                         "(needs ultralytics)")
    ap.add_argument("--people-frame", default=None,
                    help="keep people from ONLY this frame index (or 'auto'), masked in all "
                         "others -> a sharp 'frozen instant' of the crowd in the 3D scene. "
                         "Best result when the fly-through stays near that frame's camera.")
    args = ap.parse_args()

    out = Path(args.out)

    t0 = time.time()
    if args.images_dir:
        # Feed images straight in (no video frame extraction). iPhone HEICs are
        # converted to JPG automatically; already-JPG/PNG folders are used as-is.
        _convert_heic(args.images_dir)
        exts = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.PNG")
        image_paths = sorted(str(p) for e in exts for p in Path(args.images_dir).glob(e))
        image_paths = image_paths[:args.max_frames]
        print(f"[run] using {len(image_paths)} images from {args.images_dir}")
    else:
        # 1) clips -> frames (no torch needed)
        from core.frames import extract_frames

        specs = extract_frames(args.clips_dir, out / "frames",
                               max_frames=args.max_frames, clips=args.clip,
                               start=args.start, end=args.end)
        image_paths = [s.path for s in specs]
    if not image_paths:
        raise SystemExit("No frames found — check --clips-dir / --clip / --images-dir.")

    # 2) frames -> predictions (torch, GPU)
    from core.reconstruct import reconstruct

    recon = reconstruct(
        image_paths,
        backend=args.backend,
        checkpoint=args.checkpoint,
        resolution=args.resolution,
        conf_percentile=args.conf_percentile,
        viz_dir=None if args.no_viz else str(out / "viz"),
        clean=not args.no_clean,
        voxel=args.voxel,
        nerfstudio_dir=str(out / "nerfstudio") if args.nerfstudio else None,
        mask_people=args.mask_people,
        people_ref=args.people_frame,
    )

    # 3) predictions -> GLB
    from core.export import to_glb

    glb = to_glb(recon, out / "scene.glb", add_cameras=not args.no_cameras)

    # Peak VRAM, if available.
    try:
        import torch

        if torch.cuda.is_available():
            peak = torch.cuda.max_memory_allocated() / 1e9
            print(f"[run] peak VRAM: {peak:.2f} GB")
    except Exception:
        pass

    print(f"[run] done in {time.time() - t0:.1f}s -> {glb}")


if __name__ == "__main__":
    main()
