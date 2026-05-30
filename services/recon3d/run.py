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


def main() -> None:
    ap = argparse.ArgumentParser(description="OpenEyes 3D reconstruction (VGGT / VGGT-Omega)")
    ap.add_argument("--clips-dir", default="data/clips", help="folder of .mp4 clips")
    ap.add_argument("--out", default="out", help="output folder")
    ap.add_argument("--backend", choices=["vggt", "omega"], default="vggt")
    ap.add_argument("--checkpoint", default=None,
                    help="omega: path to .pt; vggt: HF repo id (default facebook/VGGT-1B)")
    ap.add_argument("--resolution", type=int, default=512)
    ap.add_argument("--max-frames", type=int, default=60)
    ap.add_argument("--conf-percentile", type=float, default=50.0,
                    help="drop points below this confidence percentile")
    ap.add_argument("--no-cameras", action="store_true", help="omit camera frustums in GLB")
    args = ap.parse_args()

    out = Path(args.out)
    frames_dir = out / "frames"

    # 1) clips -> frames (no torch needed)
    from core.frames import extract_frames

    t0 = time.time()
    specs = extract_frames(args.clips_dir, frames_dir, max_frames=args.max_frames)
    image_paths = [s.path for s in specs]
    if not image_paths:
        raise SystemExit("No frames extracted — check --clips-dir.")

    # 2) frames -> predictions (torch, GPU)
    from core.reconstruct import reconstruct

    recon = reconstruct(
        image_paths,
        backend=args.backend,
        checkpoint=args.checkpoint,
        resolution=args.resolution,
        conf_percentile=args.conf_percentile,
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
