"""Person (distractor) masks so Gaussian Splatting ignores moving people.

3DGS assumes a static scene; moving people corrupt it. We segment people per
frame and write masks where static pixels = keep (255), people = ignore (0).
nerfstudio computes its loss only where the mask is > 0, so the splat fits just
the static scene (street, building, cars) — the moving crowd is excluded.

Uses Ultralytics YOLO-seg (person class). Import + model download are lazy, so
this only runs on the pod when masking is requested.
"""

from __future__ import annotations

import numpy as np


def person_keep_masks(rgb: np.ndarray, dilate: int = 19, conf: float = 0.15,
                      model_name: str = "yolov8x-seg.pt") -> np.ndarray:
    """rgb (S,H,W,3) uint8 -> keep-masks (S,H,W) uint8 (255 keep, 0 = person).

    Lower ``conf`` catches faint/partial/blurry people; larger ``dilate`` covers
    their edges and motion halo so they don't leak into the splat.
    """
    import cv2
    from ultralytics import YOLO

    model = YOLO(model_name)
    S, H, W, _ = rgb.shape
    keep = np.full((S, H, W), 255, np.uint8)
    kernel = np.ones((dilate, dilate), np.uint8) if dilate else None

    n_masked = 0
    for i in range(S):
        bgr = cv2.cvtColor(rgb[i], cv2.COLOR_RGB2BGR)
        res = model.predict(bgr, classes=[0], conf=conf, verbose=False)[0]  # class 0 = person
        if res.masks is None:
            continue
        m = res.masks.data.cpu().numpy()                 # (n, mh, mw) in [0,1]
        union = (m.max(axis=0) > 0.5).astype(np.uint8) * 255
        union = cv2.resize(union, (W, H), interpolation=cv2.INTER_NEAREST)
        if kernel is not None:
            union = cv2.dilate(union, kernel)            # cover edges/shadows
        keep[i][union > 0] = 0
        n_masked += 1

    frac = 1.0 - keep.mean() / 255.0
    print(f"[masks] people found in {n_masked}/{S} frames; {frac*100:.1f}% of pixels masked out")
    return keep
