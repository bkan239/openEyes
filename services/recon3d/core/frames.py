"""Extract a set of input frames from the demo clips.

VGGT-style models take a set of images and infer poses + depth jointly, so the
job here is to pick frames that (a) cover the scene from the available angles
and (b) are sharp. We sample evenly across each clip and, within each sampling
window, keep the sharpest frame (variance-of-Laplacian) to avoid motion blur.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass
class FrameSpec:
    """One extracted frame and where it came from."""

    path: str
    clip: str
    frame_index: int
    sharpness: float


def _sharpness(gray: np.ndarray) -> float:
    """Variance of the Laplacian — higher is sharper."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def extract_frames(
    clips_dir: str | os.PathLike,
    out_dir: str | os.PathLike,
    max_frames: int = 60,
    min_sharpness: float = 0.0,
) -> list[FrameSpec]:
    """Sample up to ``max_frames`` sharp frames across all clips in ``clips_dir``.

    Frames are written as JPEGs to ``out_dir`` and returned as FrameSpec records.
    The per-clip budget is split evenly across the clips found.
    """
    clips_dir = Path(clips_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    clips = sorted(p for p in clips_dir.glob("*.mp4"))
    if not clips:
        raise FileNotFoundError(f"No .mp4 clips found in {clips_dir}")

    per_clip = max(1, max_frames // len(clips))
    specs: list[FrameSpec] = []

    for clip in clips:
        cap = cv2.VideoCapture(str(clip))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        if total <= 0:
            print(f"  ! could not read frame count for {clip.name}, skipping")
            cap.release()
            continue

        # Evenly spaced sampling windows; keep the sharpest frame per window.
        windows = np.linspace(0, total - 1, per_clip + 1).astype(int)
        for w in range(per_clip):
            lo, hi = windows[w], max(windows[w] + 1, windows[w + 1])
            best = None  # (sharpness, frame_index, image)
            # Probe a few candidates inside the window.
            for fi in np.linspace(lo, hi - 1, num=min(5, hi - lo)).astype(int):
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
                ok, img = cap.read()
                if not ok:
                    continue
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                s = _sharpness(gray)
                if best is None or s > best[0]:
                    best = (s, int(fi), img)
            if best is None or best[0] < min_sharpness:
                continue
            s, fi, img = best
            name = f"{clip.stem}_{fi:06d}.jpg"
            dest = out_dir / name
            cv2.imwrite(str(dest), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            specs.append(FrameSpec(str(dest), clip.stem, fi, s))

        cap.release()
        print(f"  {clip.name}: sampled {per_clip} frames")

    print(f"Extracted {len(specs)} frames to {out_dir}")
    return specs
