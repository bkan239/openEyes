"""One-shot AnySplat: a folder of images -> fly-through video. For testing and
A/B comparison against the optimization pipeline (../pipeline.py).

    source .venv-anysplat/bin/activate
    python run_once.py --images-dir ../data/easy_data/pics --out outputs/room

Loads the model fresh each call (so it's slower than serve.py, which keeps it warm).
"""

from __future__ import annotations

import argparse

import anysplat_recon as ar


def main() -> None:
    ap = argparse.ArgumentParser(description="AnySplat one-shot: images -> fly-through")
    ap.add_argument("--images-dir", required=True, help="folder of photos (HEIC auto-converted)")
    ap.add_argument("--out", default="outputs/run", help="output folder for the video + ply")
    args = ap.parse_args()

    model = ar.load_model()
    ar.reconstruct(model, args.images_dir, args.out)


if __name__ == "__main__":
    main()
