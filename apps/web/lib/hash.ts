/**
 * Capture-provenance hashing, browser side.
 *
 * Mirrors the README: hash = SHA-256(media bytes + capture context). On a real
 * mobile device this hash is additionally *signed* in the Secure Enclave /
 * Android Keystore. The web PWA can prove integrity (the bytes weren't altered)
 * but not hardware-backed provenance — that's the native-app upgrade.
 */
export async function hashMediaWithContext(
  media: Blob,
  context: { deviceId: string; capturedAt: string; gps?: { lat: number; lng: number } },
): Promise<string> {
  const mediaBytes = new Uint8Array(await media.arrayBuffer());
  const contextStr = JSON.stringify({
    deviceId: context.deviceId,
    capturedAt: context.capturedAt,
    gps: context.gps ?? null,
  });
  const contextBytes = new TextEncoder().encode(contextStr);

  const combined = new Uint8Array(mediaBytes.length + contextBytes.length);
  combined.set(mediaBytes, 0);
  combined.set(contextBytes, mediaBytes.length);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Stable, anonymous per-browser device id (persisted in localStorage). */
export function getDeviceId(): string {
  const KEY = "openeyes_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `web_${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
