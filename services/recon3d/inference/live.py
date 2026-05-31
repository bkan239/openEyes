#!/usr/bin/env python3
"""On-demand live reconstruction from the main app's captures.

The teammate app collects everyone's photos and exposes them as a zip at a plain
URL. This fetches that zip, unzips it, and renders ONE clean hero fly-through.

    source .venv-anysplat/bin/activate
    python live.py --url "https://.../captures.zip"
    # -> outputs/live/hero.mp4  and  outputs/latest.mp4
    # view it big:  python -m http.server 8080   ->  http://localhost:8080/show.html

Loads the model fresh each run (~1-2 min). For repeated/instant runs during the
pitch, keep the warm server (app.py / serve.py) up instead.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import anysplat_recon as ar

HERE = Path(__file__).resolve().parent


def main() -> None:
    ap = argparse.ArgumentParser(description="fetch captures zip -> hero fly-through")
    ap.add_argument("--url", required=True, help="plain URL returning a .zip of photos")
    ap.add_argument("--out", default="outputs/live", help="output folder")
    ap.add_argument("--t", type=int, default=24, help="interpolated frames between views (smoothness)")
    ap.add_argument("--height", type=int, default=1080, help="output video height (px)")
    args = ap.parse_args()

    out = Path(args.out)
    inputs = out / "inputs"
    ar.fetch_and_unzip(args.url, inputs)

    model = ar.load_model()
    hero = ar.reconstruct_hero(model, inputs, out, t=args.t, height=args.height)

    latest = HERE / "outputs" / "latest.mp4"
    latest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(hero, latest)
    print(f"[live] ✅ done -> {hero}")
    print(f"[live] view big: python -m http.server 8080  ->  http://localhost:8080/show.html")


if __name__ == "__main__":
    main()
