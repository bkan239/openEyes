import type {
  CreateUploadUrlRequest,
  CreateUploadUrlResponse,
  Event,
  RegisterClipRequest,
} from "@openeyes/shared";
import { API_URL } from "./config";
import { demoEvents, findDemoEvent } from "./mock";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // Always hit the live API; events change as clips are uploaded.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// ── Reads (with graceful demo fallback) ──────────────────────────────────

export async function listEvents(): Promise<Event[]> {
  try {
    return await getJson<Event[]>("/events");
  } catch {
    // Backend not deployed yet — show demo data so the UI still works.
    return demoEvents;
  }
}

export async function getEvent(id: string): Promise<Event | null> {
  try {
    return await getJson<Event>(`/events/${id}`);
  } catch {
    return findDemoEvent(id) ?? null;
  }
}

// ── Capture/upload flow (no fallback — needs the live API) ────────────────

export function createUploadUrl(
  body: CreateUploadUrlRequest,
): Promise<CreateUploadUrlResponse> {
  return postJson<CreateUploadUrlResponse>("/clips/upload-url", body);
}

export function registerClip(body: RegisterClipRequest): Promise<{ ok: true }> {
  return postJson("/clips", body);
}
