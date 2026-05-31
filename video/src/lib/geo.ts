/**
 * Local equirectangular projection for the incident.
 * Camera positions are stored as metres East / North of the cluster centroid
 * (derived from the real GPS in angles/src/data/pretti-clips.json). We map metres
 * → screen px with a fixed scale so the convergence reads clearly on a 1920×1080
 * stage, with room kept on the right for the ALL ANGLES panel.
 */
export const MAP = { cx: 770, cy: 500, scale: 3.1 } as const;

export function project(xm: number, ym: number): { x: number; y: number } {
  return { x: MAP.cx + xm * MAP.scale, y: MAP.cy - ym * MAP.scale };
}

/** Screen-space bearing (deg, 0 = +x / east, CW) from a camera toward a target. */
export function bearingTo(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): number {
  return (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;
}
