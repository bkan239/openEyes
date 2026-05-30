// Interpolate spatial samples (5 Hz, ported from mockstudio's Preview).
import type { SpatialSample } from "./types";

export interface Pose {
  lat: number;
  lon: number;
  heading: number;
  altitude?: number;
}

export function poseAt(samples: SpatialSample[], t_ms: number): Pose | null {
  if (!samples.length) return null;
  if (t_ms <= samples[0].t_ms) {
    const s = samples[0];
    return { lat: s.lat, lon: s.lon, heading: s.heading ?? 0, altitude: s.altitude };
  }
  if (t_ms >= samples[samples.length - 1].t_ms) {
    const s = samples[samples.length - 1];
    return { lat: s.lat, lon: s.lon, heading: s.heading ?? 0, altitude: s.altitude };
  }
  let lo = 0,
    hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t_ms <= t_ms) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const u = (t_ms - a.t_ms) / Math.max(1, b.t_ms - a.t_ms);
  return {
    lat: a.lat + (b.lat - a.lat) * u,
    lon: a.lon + (b.lon - a.lon) * u,
    heading: lerpHeading(a.heading ?? 0, b.heading ?? 0, u),
    altitude:
      a.altitude !== undefined && b.altitude !== undefined
        ? a.altitude + (b.altitude - a.altitude) * u
        : undefined
  };
}

export function lerpHeading(a: number, b: number, u: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * u + 360) % 360;
}
