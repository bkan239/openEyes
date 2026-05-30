"""Export a Reconstruction to a GLB scene (colored point cloud + camera markers).

GLB is chosen because every web 3D viewer reads it (`<model-viewer>`, three.js,
Blender), which keeps the output frontend-agnostic — recon3d's own viewer or a
teammate's frontend can load the same file.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import trimesh

from .reconstruct import Reconstruction


def _to_4x4(extr: np.ndarray) -> np.ndarray:
    """Normalize a (3,4) or (4,4) extrinsic to (4,4)."""
    if extr.shape == (4, 4):
        return extr
    out = np.eye(4)
    out[:3, :4] = extr
    return out


def _camera_to_world(extr_w2c: np.ndarray) -> np.ndarray:
    """VGGT extrinsics are world-to-camera (OpenCV). Invert for placement."""
    return np.linalg.inv(_to_4x4(extr_w2c))


def _frustum(scale: float = 0.15) -> trimesh.Trimesh:
    """A small camera-shaped pyramid pointing down +Z (OpenCV camera looks +Z)."""
    apex = [0, 0, 0]
    base = [
        [-scale, -scale, scale * 2],
        [scale, -scale, scale * 2],
        [scale, scale, scale * 2],
        [-scale, scale, scale * 2],
    ]
    verts = np.array([apex, *base])
    faces = np.array(
        [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 2, 3], [1, 3, 4]]
    )
    return trimesh.Trimesh(vertices=verts, faces=faces)


def to_glb(recon: Reconstruction, out_path: str | Path, add_cameras: bool = True,
           max_points: int = 600_000) -> Path:
    """Write the reconstruction to ``out_path`` (.glb). Returns the path."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    pts, cols = recon.points, recon.colors
    if len(pts) > max_points:
        idx = np.random.choice(len(pts), max_points, replace=False)
        pts, cols = pts[idx], cols[idx]

    scene = trimesh.Scene()
    cloud = trimesh.PointCloud(vertices=pts, colors=cols)
    scene.add_geometry(cloud, geom_name="points")

    if add_cameras and recon.extrinsics is not None:
        # Size markers from the camera-path extent (robust — point outliers can
        # inflate the cloud bbox), and keep them small.
        centers = np.array([_camera_to_world(np.asarray(e))[:3, 3] for e in recon.extrinsics])
        cam_scale = 0.02 * float(np.linalg.norm(centers.max(0) - centers.min(0)) or 1.0)
        cam_color = np.array([255, 80, 80, 255], dtype=np.uint8)
        for i, extr in enumerate(recon.extrinsics):
            c2w = _camera_to_world(np.asarray(extr))
            fr = _frustum(scale=cam_scale)
            fr.apply_transform(c2w)
            fr.visual.vertex_colors = np.tile(cam_color, (len(fr.vertices), 1))
            scene.add_geometry(fr, geom_name=f"cam_{i:02d}")

    scene.export(out_path)
    print(f"[export] wrote {out_path} ({len(pts):,} points, "
          f"{len(recon.extrinsics) if add_cameras else 0} cameras)")
    return out_path
