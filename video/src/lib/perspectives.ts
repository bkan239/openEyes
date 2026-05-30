import { ramp } from "../theme";

/**
 * The five Pretti eyewitness perspectives — identities mirror
 * angles/src/lib/perspectives.ts; geo (metres E/N from centroid) and timing are
 * derived from the real capture metadata in angles/src/data/pretti-clips.json.
 *
 * `onlineSec` = capture offset from the first camera (M @ 08:00:00).
 * `clipStartSec` = where we start playing inside the source clip — kept early so
 * only non-graphic street/approach footage is shown.
 */
export interface Persp {
  id: string; // full uuid = clip filename
  initial: string;
  handle: string;
  device: string;
  color: string;
  xm: number; // metres east of centroid
  ym: number; // metres north of centroid
  onlineSec: number;
  durSec: number;
  clipStartSec: number;
  /** HEVC/HDR source — render tone-mapped off so it isn't washed out. */
  hevc?: boolean;
}

export const PERSPS: Persp[] = [
  { id: "227a4b91-223c-4927-88e8-7e268c31d4a3", initial: "M", handle: "@marisol.vega", device: "iPhone 14", color: ramp[0], xm: -10.7, ym: -15.8, onlineSec: 0, durSec: 163.6, clipStartSec: 1.0 },
  { id: "1596c70a-b4e6-4f95-826c-48969691488f", initial: "D", handle: "@deshawn_k", device: "Pixel 7", color: ramp[1], xm: -8.4, ym: 4.2, onlineSec: 21.4, durSec: 120.5, clipStartSec: 2.0 },
  { id: "40e0fef5-be11-44a2-9efc-83a557180b89", initial: "R", handle: "@rfuentes.mn", device: "Dashcam", color: ramp[2], xm: 18.4, ym: -84.8, onlineSec: 22.2, durSec: 42.5, clipStartSec: 2.5 },
  { id: "ceb4a254-f85b-4155-a7e9-42bed3cc27bd", initial: "A", handle: "@a.nordstrom", device: "Bodycam", color: ramp[3], xm: -25.7, ym: 51.0, onlineSec: 28.0, durSec: 57.3, clipStartSec: 1.5, hevc: true },
  { id: "d1ba1059-1c37-4f04-8677-1c9c82983064", initial: "J", handle: "@jjokafor", device: "Transit cam", color: ramp[4], xm: 26.3, ym: 45.4, onlineSec: 52.4, durSec: 23.8, clipStartSec: 0.5 },
];

/** Incident focus point (Alex Pretti) — PRETTI_CENTER, metres from centroid. */
export const VICTIM = { xm: -21.8, ym: -3.6, label: "A. PRETTI" } as const;

/** The 0..N second window the editorial timeline spans. */
export const WINDOW_SEC = 80;
