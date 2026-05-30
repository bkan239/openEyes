const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export type VideoPreloadState = {
  total: number;
  ready: number;
  readyIds: ReadonlySet<string>;
  complete: boolean;
};

type Listener = (state: VideoPreloadState) => void;

const EMPTY: VideoPreloadState = {
  total: 0,
  ready: 0,
  readyIds: new Set(),
  complete: true
};

let state: VideoPreloadState = EMPTY;
const listeners = new Set<Listener>();
const warmers: HTMLVideoElement[] = [];

function emit() {
  for (const listener of listeners) listener(state);
}

function markReady(id: string) {
  if (state.readyIds.has(id)) return;
  const readyIds = new Set(state.readyIds);
  readyIds.add(id);
  state = {
    total: state.total,
    ready: readyIds.size,
    readyIds,
    complete: readyIds.size >= state.total
  };
  emit();
}

function cleanupWarmers() {
  for (const v of warmers) {
    v.removeAttribute("src");
    v.load();
  }
  warmers.length = 0;
}

/** Warm the browser cache with direct URLs — does not block the UI. */
export function preloadDemoVideos(items: Array<{ id: string; file_url: string }>): () => void {
  cleanupWarmers();

  const clips = items.filter((m) => VIDEO_EXT.test(m.file_url));
  state = {
    total: clips.length,
    ready: 0,
    readyIds: new Set(),
    complete: clips.length === 0
  };
  emit();

  for (const { id, file_url } of clips) {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = file_url;

    const onReady = () => markReady(id);
    v.addEventListener("canplaythrough", onReady, { once: true });
    v.addEventListener("error", onReady, { once: true });
    v.load();
    warmers.push(v);
  }

  return cleanupWarmers;
}

export function getVideoPreloadState(): VideoPreloadState {
  return state;
}

export function isVideoPreloadReady(id: string): boolean {
  return state.readyIds.has(id);
}

export function subscribeVideoPreload(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
