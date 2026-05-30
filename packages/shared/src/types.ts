/**
 * Core domain model for OpenEyes, shared between the Next.js web app and any
 * TypeScript tooling. The FastAPI backend mirrors these shapes in
 * `services/api/app/models/schemas.py` — keep the two in sync.
 *
 * Field naming is camelCase on the wire (the API serialises with camelCase
 * aliases), so these types describe the JSON exactly as the frontend sees it.
 */

export type EventStatus = "pending" | "verified" | "disputed";
export type ClipStatus = "uploaded" | "processing" | "matched" | "rejected";
export type TrustLevel = "low" | "medium" | "high";

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Optional human-readable place label. */
  label?: string;
}

/**
 * An anonymous contributor. We deliberately store as little identifying
 * information as possible — see the "Source safety" note in the README.
 */
export interface Source {
  id: string;
  /** Opaque per-device identifier, not tied to a real-world identity. */
  deviceId: string;
}

/**
 * Per-clip verification signal produced before corroboration:
 * capture-provenance check + AI manipulation scan.
 */
export interface ClipVerification {
  /** 0 = looks authentic, 1 = almost certainly manipulated. */
  aiManipulationScore: number;
  /** True when the on-upload hash matched the registered hash. */
  provenanceValid: boolean;
  /** Free-form explanation for the UI / Q&A. */
  notes?: string;
}

/** A single uploaded recording — one angle of (potentially) one event. */
export interface Clip {
  id: string;
  /** Null until the clustering step assigns it to an event. */
  eventId: string | null;
  sourceId: string;
  /** S3 object key of the stored media. */
  mediaKey: string;
  /** SHA-256 over media bytes + capture context, computed on the device. */
  hash: string;
  /** On-device signature over the hash (Secure Enclave / Keystore). */
  signature?: string;
  /** Client-reported capture time (a signal, not proof). */
  capturedAt: string;
  /** Server receive-time stamp (authoritative). */
  receivedAt: string;
  /** Client-reported capture location (a signal, not proof). */
  gps?: GeoPoint;
  deviceId: string;
  durationSec?: number;
  status: ClipStatus;
  verification?: ClipVerification;
}

/** One weighted piece of the explainable trust chain. */
export interface TrustSignal {
  key: string;
  label: string;
  /** Normalised contribution in [0, 1]. */
  value: number;
  /** Relative importance; weights across signals sum to 1. */
  weight: number;
  /** Human-readable evidence shown in the UI. */
  detail: string;
}

/** The explainable trust score — a probability, never a naked verdict. */
export interface TrustScore {
  /** Aggregate probability in [0, 1]. */
  score: number;
  level: TrustLevel;
  signals: TrustSignal[];
}

/** A verified (or candidate) real-world event with all its angles. */
export interface Event {
  id: string;
  title: string;
  status: EventStatus;
  location?: GeoPoint;
  /** When the event is believed to have happened. */
  occurredAt: string;
  createdAt: string;
  trust: TrustScore;
  clips: Clip[];
}

// ── API request/response payloads ────────────────────────────────────────

export interface CreateUploadUrlRequest {
  contentType: string;
  /** SHA-256 the client computed for the media (hex). */
  hash: string;
  deviceId: string;
  capturedAt: string;
  gps?: GeoPoint;
}

export interface CreateUploadUrlResponse {
  clipId: string;
  /** Presigned S3 PUT URL the browser uploads the bytes to. */
  uploadUrl: string;
  mediaKey: string;
}

export interface RegisterClipRequest {
  clipId: string;
  signature?: string;
  durationSec?: number;
}
