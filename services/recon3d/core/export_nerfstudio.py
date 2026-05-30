"""Export a VGGT-Omega reconstruction as a nerfstudio dataset for Splatfacto.

Writes a folder that `ns-train splatfacto --data <folder>` reads directly:

    <out>/
      transforms.json     # cameras: intrinsics + camera-to-world per frame
      images/frame_NNN.jpg# the exact frames the model saw (intrinsics match)
      sparse_pc.ply       # VGGT point cloud -> Gaussian initialization

Why the model's own images (not the original full-res frames): VGGT's
intrinsics correspond to its *preprocessed* image size. Using those same images
means fx/fy/cx/cy match exactly — no resize/crop/aspect bugs. (A later high-res
pass could rescale intrinsics to the native frames, but correctness first.)

Conventions: VGGT extrinsics are world-to-camera (OpenCV). nerfstudio wants
camera-to-world in OpenGL axes, so we invert then flip Y/Z.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


# OpenCV camera (x right, y down, z forward) -> OpenGL (x right, y up, z back).
_CV_TO_GL = np.diag([1.0, -1.0, -1.0, 1.0])


def _c2w_opengl(extr_w2c: np.ndarray) -> np.ndarray:
    e = extr_w2c
    if e.shape == (3, 4):
        e = np.vstack([e, [0, 0, 0, 1]])
    c2w = np.linalg.inv(e)
    return c2w @ _CV_TO_GL


def write(out_dir, *, rgb, extrinsics, intrinsics, points, colors, masks=None) -> Path:
    """Write the nerfstudio dataset. ``rgb`` is (S,H,W,3) uint8 (model images).

    ``masks`` (optional, S,H,W uint8: 255 keep / 0 ignore) excludes moving people
    from the splat loss — nerfstudio trains only where the mask is > 0.
    """
    import cv2
    import trimesh

    out_dir = Path(out_dir)
    (out_dir / "images").mkdir(parents=True, exist_ok=True)
    if masks is not None:
        (out_dir / "masks").mkdir(parents=True, exist_ok=True)

    S, H, W, _ = rgb.shape
    frames = []
    for i in range(S):
        name = f"images/frame_{i:04d}.jpg"
        cv2.imwrite(str(out_dir / name), cv2.cvtColor(rgb[i], cv2.COLOR_RGB2BGR),
                    [cv2.IMWRITE_JPEG_QUALITY, 95])
        K = np.asarray(intrinsics[i], dtype=float)
        frame = {
            "file_path": name,
            "fl_x": float(K[0, 0]), "fl_y": float(K[1, 1]),
            "cx": float(K[0, 2]), "cy": float(K[1, 2]),
            "w": W, "h": H,
            "transform_matrix": _c2w_opengl(np.asarray(extrinsics[i])).tolist(),
        }
        if masks is not None:
            mname = f"masks/mask_{i:04d}.png"
            cv2.imwrite(str(out_dir / mname), masks[i])
            frame["mask_path"] = mname
        frames.append(frame)

    K0 = np.asarray(intrinsics[0], dtype=float)
    meta = {
        "camera_model": "OPENCV",
        "fl_x": float(K0[0, 0]), "fl_y": float(K0[1, 1]),
        "cx": float(K0[0, 2]), "cy": float(K0[1, 2]),
        "w": W, "h": H,
        "ply_file_path": "sparse_pc.ply",
        "frames": frames,
    }
    (out_dir / "transforms.json").write_text(json.dumps(meta, indent=2))

    # Point-cloud init for the Gaussians.
    trimesh.PointCloud(vertices=np.asarray(points), colors=np.asarray(colors)).export(
        str(out_dir / "sparse_pc.ply"))

    print(f"[nerfstudio] wrote dataset to {out_dir} "
          f"({S} cameras, {len(points):,} init points)")
    print(f"[nerfstudio] train:  ns-train splatfacto --data {out_dir}")
    return out_dir
