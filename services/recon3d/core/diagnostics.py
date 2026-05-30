"""Dump intermediate visualizations so we can SEE what the model saw and predicted.

Writes everything to a viz dir:
  frames_contact.jpg   – every input frame the model actually ran on (numbered)
  depth/depth_NN.png   – per-frame predicted depth (turbo colormap)
  conf/conf_NN.png     – per-frame confidence (viridis); low conf = noise
  conf_hist.png        – confidence histogram + the cutoff we filtered at
  cameras.png          – top-down camera layout + 3D point cloud scatter
  summary.txt          – counts, ranges, per-frame stats

This runs on the pod (needs matplotlib + cv2). Import lazily.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np


def _contact_sheet(rgb: np.ndarray, out_path: Path, cols: int = 6, tile_h: int = 220) -> None:
    import cv2

    S, H, W, _ = rgb.shape
    tw = max(1, int(tile_h * W / H))
    rows = (S + cols - 1) // cols
    sheet = np.full((rows * tile_h, cols * tw, 3), 18, np.uint8)
    for i in range(S):
        r, c = divmod(i, cols)
        tile = cv2.resize(rgb[i], (tw, tile_h))
        sheet[r * tile_h:(r + 1) * tile_h, c * tw:(c + 1) * tw] = tile
        cv2.putText(sheet, str(i), (c * tw + 6, r * tile_h + 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    cv2.imwrite(str(out_path), cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))


def _colormap_stack(maps: np.ndarray, out_dir: Path, prefix: str, cmap) -> None:
    import cv2

    out_dir.mkdir(parents=True, exist_ok=True)
    for i, m in enumerate(maps):
        lo, hi = np.nanpercentile(m, 2), np.nanpercentile(m, 98)
        norm = np.clip((m - lo) / (hi - lo + 1e-6), 0, 1)
        img = cv2.applyColorMap((norm * 255).astype(np.uint8), cmap)
        cv2.imwrite(str(out_dir / f"{prefix}_{i:02d}.png"), img)


def _camera_centers(extr: np.ndarray):
    """World-to-camera extrinsics -> camera centers + viewing directions in world."""
    centers, dirs = [], []
    for E in extr:
        R, t = E[:3, :3], E[:3, 3]
        centers.append(-R.T @ t)
        dirs.append(R.T @ np.array([0.0, 0.0, 1.0]))  # camera looks +Z (OpenCV)
    return np.asarray(centers), np.asarray(dirs)


def _plot_cameras(extr, points, colors, out_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    centers, dirs = _camera_centers(extr)
    fig = plt.figure(figsize=(14, 6))

    # Top-down (X vs Z): cloud + camera positions + headings.
    ax = fig.add_subplot(121)
    if points is not None and len(points):
        s = points[np.random.choice(len(points), min(25000, len(points)), replace=False)]
        ax.scatter(s[:, 0], s[:, 2], s=0.4, c="lightgray", alpha=0.4, linewidths=0)
    ax.scatter(centers[:, 0], centers[:, 2], c=range(len(centers)), cmap="rainbow", s=45, zorder=3)
    ax.quiver(centers[:, 0], centers[:, 2], dirs[:, 0], dirs[:, 2],
              color="red", angles="xy", width=0.004)
    ax.set_title("Top-down (X–Z): cameras (colored) + cloud")
    ax.set_xlabel("X"); ax.set_ylabel("Z"); ax.set_aspect("equal", "datalim")

    # 3D scatter of the colored cloud.
    ax3 = fig.add_subplot(122, projection="3d")
    if points is not None and len(points):
        idx = np.random.choice(len(points), min(30000, len(points)), replace=False)
        p, c = points[idx], colors[idx] / 255.0
        ax3.scatter(p[:, 0], p[:, 2], -p[:, 1], c=c, s=0.5, linewidths=0)
        ax3.scatter(centers[:, 0], centers[:, 2], -centers[:, 1], c="red", s=30)
    ax3.set_title("Point cloud (3D)")
    ax3.set_xlabel("X"); ax3.set_ylabel("Z"); ax3.set_zlabel("-Y")

    fig.tight_layout()
    fig.savefig(out_path, dpi=110)
    plt.close(fig)


def _conf_hist(conf: np.ndarray, percentile: float, out_path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    flat = conf.reshape(-1)
    thr = np.percentile(flat, percentile)
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.hist(flat, bins=120, color="steelblue")
    ax.axvline(thr, color="red", ls="--", label=f"{percentile:.0f}th pct cutoff = {thr:.3f}")
    ax.set_title("Per-pixel confidence (points below the line are dropped)")
    ax.legend()
    fig.tight_layout(); fig.savefig(out_path, dpi=110); plt.close(fig)


def dump(viz_dir, *, rgb, depth, conf, extr, intr, points, colors, conf_percentile) -> None:
    """Write the full diagnostic set to ``viz_dir``."""
    import cv2

    viz_dir = Path(viz_dir)
    viz_dir.mkdir(parents=True, exist_ok=True)
    print(f"[diagnostics] writing visualizations to {viz_dir}")

    _contact_sheet(rgb, viz_dir / "frames_contact.jpg")
    if depth is not None:
        _colormap_stack(depth, viz_dir / "depth", "depth", cv2.COLORMAP_TURBO)
    if conf is not None:
        _colormap_stack(conf, viz_dir / "conf", "conf", cv2.COLORMAP_VIRIDIS)
        _conf_hist(conf, conf_percentile, viz_dir / "conf_hist.png")
    _plot_cameras(extr, points, colors, viz_dir / "cameras.png")

    centers, _ = _camera_centers(extr)
    spread = centers.max(0) - centers.min(0)
    lines = [
        f"frames (cameras): {len(extr)}",
        f"kept points: {len(points):,}",
        f"camera-center spread (X,Y,Z): {spread.round(3).tolist()}",
        f"point bbox min: {np.round(points.min(0), 3).tolist() if len(points) else 'n/a'}",
        f"point bbox max: {np.round(points.max(0), 3).tolist() if len(points) else 'n/a'}",
    ]
    if depth is not None:
        lines.append(f"depth range: [{np.nanmin(depth):.3f}, {np.nanmax(depth):.3f}]")
    (viz_dir / "summary.txt").write_text("\n".join(lines) + "\n")
    print("[diagnostics] " + " | ".join(lines))
