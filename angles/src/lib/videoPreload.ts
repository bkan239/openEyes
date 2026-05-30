import type { UserMedia } from "./types";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

const warmIds = new Set<string>();
const warmers: HTMLVideoElement[] = [];

function timelineOrder(items: UserMedia[]): UserMedia[] {
  return [...items]
    .filter((m) => VIDEO_EXT.test(m.file_url))
    .sort(
      (a, b) =>
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );
}

function warmClip(url: string): Promise<void> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;

    const done = () => resolve();
    v.addEventListener("canplaythrough", done, { once: true });
    v.addEventListener("error", done, { once: true });
    v.load();
    warmers.push(v);
  });
}

function cleanupWarmers() {
  for (const v of warmers) {
    v.removeAttribute("src");
    v.load();
  }
  warmers.length = 0;
  warmIds.clear();
}

/** Preload clips one-by-one in timeline order (wall-clock) — fills browser cache without blocking UI. */
export function preloadClipsSequential(items: UserMedia[]): () => void {
  cleanupWarmers();

  let cancel = false;
  const clips = timelineOrder(items);

  void (async () => {
    for (const clip of clips) {
      if (cancel) break;
      await warmClip(clip.file_url);
      if (!cancel) warmIds.add(clip.id);
    }
  })();

  return () => {
    cancel = true;
    cleanupWarmers();
  };
}

export function isClipWarm(id: string): boolean {
  return warmIds.has(id);
}
