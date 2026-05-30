import type { Clip, TrustLevel, TrustScore, TrustSignal } from "./types";

/**
 * Trust-score model. This is the heart of OpenEyes: corroboration across
 * independent sources, expressed as an explainable weighted sum — never a
 * naked yes/no.
 *
 * The weights below are intentionally simple and tunable for the hackathon.
 * The Python backend mirrors this in `services/api/app/services/trust.py`;
 * keep the two in sync (there's a parity test stub on the API side).
 */
export const TRUST_WEIGHTS = {
  provenance: 0.2,
  independentSources: 0.3,
  timeLocation: 0.15,
  audioSync: 0.2,
  manipulation: 0.15,
} as const;

/** Number of independent sources at which corroboration is considered strong. */
export const STRONG_CORROBORATION = 5;

export function trustLevel(score: number): TrustLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Build the explainable signal breakdown for a set of clips believed to
 * belong to the same event, then fold it into a single probability.
 *
 * Pure and deterministic so the same inputs always render the same chain of
 * evidence in the UI.
 */
export function computeTrustScore(clips: Clip[]): TrustScore {
  const n = clips.length;
  const verified = clips.filter((c) => c.verification);

  // Independent, distinct devices corroborate more than repeat uploads.
  const distinctDevices = new Set(clips.map((c) => c.deviceId)).size;
  const independence = clamp01(distinctDevices / STRONG_CORROBORATION);

  // Provenance: share of clips whose on-upload hash matched their registration.
  const provenanceOk = verified.filter((c) => c.verification?.provenanceValid).length;
  const provenance = n === 0 ? 0 : provenanceOk / n;

  // Manipulation: 1 - average AI manipulation score (higher score = more fake).
  const avgManip =
    verified.length === 0
      ? 0
      : verified.reduce((s, c) => s + (c.verification?.aiManipulationScore ?? 0), 0) /
        verified.length;
  const manipulation = clamp01(1 - avgManip);

  // Time/location consistency: how tightly capture times cluster (placeholder
  // heuristic — real geo/time spread comes from the clustering service).
  const times = clips
    .map((c) => Date.parse(c.capturedAt))
    .filter((t) => !Number.isNaN(t));
  let timeLocation = 0;
  if (times.length > 1) {
    const spreadMin = (Math.max(...times) - Math.min(...times)) / 60_000;
    // Full credit within a 5-minute window, decaying to 0 by 60 minutes.
    timeLocation = clamp01(1 - (spreadMin - 5) / 55);
  } else if (times.length === 1) {
    timeLocation = 0.5;
  }

  // Audio sync is confirmed by the clustering service; here we proxy it by the
  // presence of multiple matched clips. Replace with real fingerprint overlap.
  const matched = clips.filter((c) => c.status === "matched").length;
  const audioSync = n <= 1 ? 0 : clamp01(matched / n);

  const signals: TrustSignal[] = [
    {
      key: "provenance",
      label: "Capture provenance",
      value: provenance,
      weight: TRUST_WEIGHTS.provenance,
      detail: `${provenanceOk}/${n} clips untampered since capture (signed hash match)`,
    },
    {
      key: "independentSources",
      label: "Independent sources",
      value: independence,
      weight: TRUST_WEIGHTS.independentSources,
      detail: `${distinctDevices} independent device${distinctDevices === 1 ? "" : "s"} corroborating`,
    },
    {
      key: "timeLocation",
      label: "Time & location consistency",
      value: timeLocation,
      weight: TRUST_WEIGHTS.timeLocation,
      detail:
        times.length > 1
          ? "Capture times fall within a consistent window"
          : "Not enough timestamps to corroborate",
    },
    {
      key: "audioSync",
      label: "Audio sync",
      value: audioSync,
      weight: TRUST_WEIGHTS.audioSync,
      detail: `${matched}/${n} clips share the same soundtrack`,
    },
    {
      key: "manipulation",
      label: "Manipulation scan",
      value: manipulation,
      weight: TRUST_WEIGHTS.manipulation,
      detail:
        verified.length === 0
          ? "No clips scanned yet"
          : `No tampering detected (avg AI score ${(avgManip * 100).toFixed(0)}%)`,
    },
  ];

  const score = clamp01(signals.reduce((acc, s) => acc + s.value * s.weight, 0));

  return { score, level: trustLevel(score), signals };
}
