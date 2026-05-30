import { computeTrustScore, type Clip, type Event } from "@openeyes/shared";

/**
 * Fallback demo data so the UI renders before the backend is deployed.
 * `lib/api.ts` uses this whenever the API is unreachable. Delete once the
 * backend is wired up, or keep it for offline demos.
 */
function clip(partial: Partial<Clip> & Pick<Clip, "id" | "deviceId">): Clip {
  return {
    eventId: "evt_demo",
    sourceId: `src_${partial.deviceId}`,
    mediaKey: `demo/${partial.id}.mp4`,
    hash: "0".repeat(64),
    capturedAt: "2026-05-30T14:02:00Z",
    receivedAt: "2026-05-30T14:05:11Z",
    durationSec: 18,
    status: "matched",
    verification: { aiManipulationScore: 0.04, provenanceValid: true },
    ...partial,
  };
}

const demoClips: Clip[] = [
  clip({ id: "clip_a", deviceId: "dev_01" }),
  clip({ id: "clip_b", deviceId: "dev_02", capturedAt: "2026-05-30T14:02:03Z" }),
  clip({ id: "clip_c", deviceId: "dev_03", capturedAt: "2026-05-30T14:01:58Z" }),
  clip({
    id: "clip_d",
    deviceId: "dev_04",
    capturedAt: "2026-05-30T14:02:06Z",
    verification: { aiManipulationScore: 0.11, provenanceValid: true },
  }),
];

export const demoEvents: Event[] = [
  {
    id: "evt_demo",
    title: "Demonstration at Marktplatz",
    status: "verified",
    location: { lat: 52.520008, lng: 13.404954, label: "Berlin, Marktplatz" },
    occurredAt: "2026-05-30T14:02:00Z",
    createdAt: "2026-05-30T14:05:00Z",
    trust: computeTrustScore(demoClips),
    clips: demoClips,
  },
];

export function findDemoEvent(id: string): Event | undefined {
  return demoEvents.find((e) => e.id === id);
}
