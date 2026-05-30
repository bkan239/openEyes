import type { UserMedia } from "./types";

export const DEFAULT_CLIP_MS = 60_000;
export const DEFAULT_CLIP_SECONDS = DEFAULT_CLIP_MS / 1000;

/** Wall-clock duration of clip from samples or default minute. */
export function clipDurationMs(m: Pick<UserMedia, "samples">): number {
  if (m.samples?.length) return m.samples[m.samples.length - 1].t_ms;
  return DEFAULT_CLIP_MS;
}

export function clipWallEndMs(m: Pick<UserMedia, "captured_at" | "samples">): number {
  return new Date(m.captured_at).getTime() + clipDurationMs(m);
}

/** Seconds into the media file for a global wall-clock time; can be negative (before clip) or past duration. */
export function clipOffsetSecondsFromWall(
  m: Pick<UserMedia, "captured_at" | "samples">,
  absoluteWallMs: number
): number {
  const t0 = new Date(m.captured_at).getTime();
  return (absoluteWallMs - t0) / 1000;
}

export function isPlayheadInsideClip(
  m: Pick<UserMedia, "captured_at" | "samples">,
  absoluteWallMs: number
): boolean {
  const off = clipOffsetSecondsFromWall(m, absoluteWallMs);
  const durSec = clipDurationMs(m) / 1000;
  return off >= 0 && off <= durSec;
}
