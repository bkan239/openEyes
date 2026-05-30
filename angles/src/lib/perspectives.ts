// Editorial showcase identities for the five Pretti eyewitness clips.
// The capture JSON has no usernames/devices, so the design comp assigns each
// clip (in captured_at order) a contributor handle, device, initial, and a
// single-hue teal shade. This module is the source of truth for those — the
// AllAngles panel, the map cones/dots, the timeline letters, and the floating
// panels all resolve colour + label from here, so they stay consistent.
import { palette } from "@/styles/tokens";
import type { UserMedia } from "./types";
import { clipWallEndMs } from "./livePlayback";

export type PerspectiveStatus = "live" | "waiting" | "ended";

export interface PerspectiveIdentity {
  /** 0-based slot in captured_at order — also indexes the teal ramp. */
  order: number;
  initial: string;
  handle: string;
  device: string;
  color: string;
}

/** Clip id (captured_at order) → design identity. Ramp goes light→deep. */
const IDENTITIES: Array<Omit<PerspectiveIdentity, "color" | "order">> = [
  { initial: "M", handle: "@marisol.vega", device: "iPhone 14 · vertical" },
  { initial: "D", handle: "@deshawn_k", device: "Pixel 7 · handheld" },
  { initial: "R", handle: "@rfuentes.mn", device: "Dashcam · forward" },
  { initial: "A", handle: "@a.nordstrom", device: "Bodycam · clip-on" },
  { initial: "J", handle: "@jjokafor", device: "Transit cam · fixed" }
];

const PERSPECTIVE_IDS = [
  "227a4b91-223c-4927-88e8-7e268c31d4a3",
  "1596c70a-b4e6-4f95-826c-48969691488f",
  "40e0fef5-be11-44a2-9efc-83a557180b89",
  "ceb4a254-f85b-4155-a7e9-42bed3cc27bd",
  "d1ba1059-1c37-4f04-8677-1c9c82983064"
] as const;

const RAMP = palette.perspectiveRamp;

const BY_ID: Record<string, PerspectiveIdentity> = Object.fromEntries(
  PERSPECTIVE_IDS.map((id, i) => [
    id,
    { order: i, color: RAMP[i % RAMP.length], ...IDENTITIES[i] }
  ])
);

/** Stable fallback for any clip not in the curated five. */
function fallbackIdentity(id: string): PerspectiveIdentity {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const order = h % RAMP.length;
  return {
    order,
    initial: (id[0] ?? "?").toUpperCase(),
    handle: `@cam_${id.slice(0, 6)}`,
    device: "Eyewitness clip",
    color: RAMP[order]
  };
}

export function perspectiveFor(id: string): PerspectiveIdentity {
  return BY_ID[id] ?? fallbackIdentity(id);
}

export function perspectiveColor(id: string): string {
  return perspectiveFor(id).color;
}

/** live while the playhead is inside the clip, waiting before, ended after. */
export function statusForClip(
  m: Pick<UserMedia, "captured_at" | "samples">,
  absoluteWallMs: number
): PerspectiveStatus {
  const start = new Date(m.captured_at).getTime();
  if (absoluteWallMs < start) return "waiting";
  if (absoluteWallMs > clipWallEndMs(m)) return "ended";
  return "live";
}

/** Sort a set of clips into the curated perspective order (then by capture). */
export function byPerspectiveOrder<T extends { id: string; captured_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ao = perspectiveFor(a.id).order;
    const bo = perspectiveFor(b.id).order;
    if (ao !== bo) return ao - bo;
    return new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime();
  });
}
