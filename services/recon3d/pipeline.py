#!/usr/bin/env python3
"""One-shot pipeline: a folder of photos (or a clip) -> a fly-through video.

    photos ── VGGT-Omega ──▶ poses + point cloud (nerfstudio dataset)
                              │
                              ├─ ns-train splatfacto ──▶ Gaussian splat
                              │
                              └─ ns-render ──▶ interpolated fly-through MP4

This chains the three steps with **deterministic output paths** (no timestamp
hunting) and exposes the trajectory knobs so you can re-render variations fast
without recomputing the splat:

    # full run (photos -> video):
    python pipeline.py --images-dir data/easy_data/pics --out roomtest \
        --checkpoint /workspace/checkpoints/vggt_omega_1b_512.pt

    # tweak ONLY the trajectory (skip recon + train, ~seconds):
    python pipeline.py --out roomtest --skip-recon --skip-train \
        --interpolation-steps 60 --frame-rate 60
        # or a fully custom path designed in the ns-viewer RENDER tab:
        #   ... --camera-path roomtest/nerfstudio/camera_paths/mine.json

Works for video too: pass --clip <file.mp4> instead of --images-dir.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def sh(cmd: list[str]) -> None:
    """Run a command, inheriting stdout, with TORCHDYNAMO_DISABLE set (nerfstudio
    crashes on torch.compile in this torch build)."""
    env = {**os.environ, "TORCHDYNAMO_DISABLE": "1"}
    print("\n$ " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, env=env, cwd=HERE)


def main() -> None:
    ap = argparse.ArgumentParser(description="photos -> fly-through video (VGGT-Omega + Splatfacto)")
    # input (one of)
    ap.add_argument("--images-dir", default=None, help="folder of photos")
    ap.add_argument("--clip", default=None, help="a video clip instead of photos")
    ap.add_argument("--start", type=float, default=None, help="clip trim start (s)")
    ap.add_argument("--end", type=float, default=None, help="clip trim end (s)")
    # core
    ap.add_argument("--out", required=True, help="output folder (holds dataset, splat, video)")
    ap.add_argument("--checkpoint", default="/workspace/checkpoints/vggt_omega_1b_512.pt")
    ap.add_argument("--backend", default="omega")
    ap.add_argument("--max-frames", type=int, default=100)
    # recon passthroughs
    ap.add_argument("--conf-percentile", type=float, default=50.0)
    ap.add_argument("--resolution", type=int, default=512)
    ap.add_argument("--voxel", type=float, default=None)
    ap.add_argument("--no-clean", action="store_true")
    ap.add_argument("--no-viz", action="store_true")
    ap.add_argument("--mask-people", action="store_true")
    ap.add_argument("--people-frame", default=None)
    # train
    ap.add_argument("--iterations", type=int, default=15000)
    ap.add_argument("--method", default="splatfacto", choices=["splatfacto", "splatfacto-big"])
    ap.add_argument("--fast", action="store_true",
                    help="speed preset for live demos: ~2k iters + capped Gaussian growth "
                         "+ quick render. Trades some sharpness for a ~1-2 min splat.")
    # render / trajectory (the variability surface)
    ap.add_argument("--frame-rate", type=int, default=30)
    ap.add_argument("--interpolation-steps", type=int, default=30,
                    help="frames between consecutive cameras (higher = slower, smoother)")
    ap.add_argument("--pose-source", default="train", choices=["train", "eval"])
    ap.add_argument("--order-poses", action="store_true",
                    help="reorder cameras into a nearest-neighbour path before interpolating")
    ap.add_argument("--camera-path", default=None,
                    help="render this custom camera-path JSON (from the ns-viewer RENDER tab) "
                         "instead of interpolating through the cameras")
    # stage toggles (for fast iteration)
    ap.add_argument("--skip-recon", action="store_true", help="reuse existing <out>/nerfstudio")
    ap.add_argument("--skip-train", action="store_true", help="reuse existing trained splat")
    args = ap.parse_args()

    # --fast preset: only override values the user left at their defaults.
    train_extra: list[str] = []
    if args.fast:
        if args.iterations == 15000:
            args.iterations = 2000
        if args.interpolation_steps == 30:
            args.interpolation_steps = 20
        # cap Gaussian growth -> faster iters AND faster render
        train_extra = ["--pipeline.model.stop-split-at", "1200",
                       "--pipeline.model.densify-grad-thresh", "0.0015"]

    out = Path(args.out)
    ns_data = out / "nerfstudio"
    config = out / "nerf" / "run" / args.method / "splat" / "config.yml"
    video = out / "flythrough.mp4"

    # 1) photos/clip -> VGGT-Omega -> nerfstudio dataset ----------------------
    if not args.skip_recon:
        cmd = [sys.executable, "run.py", "--out", str(out), "--backend", args.backend,
               "--checkpoint", args.checkpoint, "--nerfstudio",
               "--max-frames", str(args.max_frames),
               "--conf-percentile", str(args.conf_percentile),
               "--resolution", str(args.resolution)]
        if args.images_dir:
            cmd += ["--images-dir", args.images_dir]
        elif args.clip:
            cmd += ["--clip", args.clip]
            if args.start is not None:
                cmd += ["--start", str(args.start)]
            if args.end is not None:
                cmd += ["--end", str(args.end)]
        else:
            raise SystemExit("Provide --images-dir or --clip (or --skip-recon to reuse a dataset).")
        if args.voxel:
            cmd += ["--voxel", str(args.voxel)]
        if args.no_clean:
            cmd += ["--no-clean"]
        if args.no_viz:
            cmd += ["--no-viz"]
        if args.mask_people:
            cmd += ["--mask-people"]
        if args.people_frame is not None:
            cmd += ["--people-frame", str(args.people_frame)]
        sh(cmd)
    if not ns_data.exists():
        raise SystemExit(f"No dataset at {ns_data} — run without --skip-recon first.")

    # 2) train the Gaussian splat (deterministic output path) -----------------
    if not args.skip_train:
        sh(["ns-train", args.method, "--data", str(ns_data),
            "--max-num-iterations", str(args.iterations),
            "--output-dir", str(out / "nerf"),
            "--experiment-name", "run", "--timestamp", "splat",
            "--viewer.quit-on-train-completion", "True"] + train_extra)
    if not config.exists():
        raise SystemExit(f"No trained splat config at {config} — run without --skip-train first.")

    # 3) render the fly-through ----------------------------------------------
    if args.camera_path:
        sh(["ns-render", "camera-path", "--load-config", str(config),
            "--camera-path-filename", args.camera_path, "--output-path", str(video)])
    else:
        cmd = ["ns-render", "interpolate", "--load-config", str(config),
               "--pose-source", args.pose_source, "--output-path", str(video),
               "--frame-rate", str(args.frame_rate),
               "--interpolation-steps", str(args.interpolation_steps)]
        if args.order_poses:
            cmd += ["--order-poses", "True"]
        sh(cmd)

    print(f"\n✅ done -> {video}")
    print("   tweak the trajectory without recomputing:")
    print(f"     python pipeline.py --out {out} --skip-recon --skip-train "
          f"--interpolation-steps 60 --frame-rate 60")


if __name__ == "__main__":
    main()
