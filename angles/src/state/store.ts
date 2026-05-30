import { create } from "zustand";
import type { MediaMapItem, Story, UserMedia } from "@/lib/types";
import { daysAgo, endOfDay, startOfDay } from "@/lib/time";

export type ViewportBounds = [number, number, number, number]; // minLon, minLat, maxLon, maxLat

export type UiMode = "product" | "showcase";

export type ShowcasePanelRect = { left: number; top: number; width: number; height: number };

interface AppState {
  // time filter
  fromDate: Date;
  toDate: Date;
  setRange: (from: Date, to: Date) => void;

  // map media
  mediaItems: MediaMapItem[];
  setMediaItems: (items: MediaMapItem[]) => void;

  // map viewport
  viewport: { center: [number, number]; zoom: number; bounds?: ViewportBounds };
  setViewport: (v: AppState["viewport"]) => void;

  // map jump target (set by sidebar / story panel, consumed by MapView)
  flyTarget: {
    center: [number, number];
    zoom: number;
    bounds?: ViewportBounds;
    duration?: number;
    bumpId: number;
  } | null;
  flyTo: (target: { center: [number, number]; zoom: number; bounds?: ViewportBounds; duration?: number }) => void;

  // stories
  stories: Story[];
  setStories: (s: Story[]) => void;
  selectedStoryId: string | null;
  setSelectedStoryId: (id: string | null) => void;
  storyMediaCache: Record<string, UserMedia[]>;
  setStoryMedia: (id: string, items: UserMedia[]) => void;

  // mock items overlay (Pretti demo) — merged into map regardless of date filter
  prettiOverlayItems: UserMedia[];
  setPrettiOverlayItems: (items: UserMedia[]) => void;

  // live mode
  liveMode: boolean;
  setLiveMode: (v: boolean) => void;
  livePlayhead: number; // ms relative to liveStart
  liveStart: number;   // epoch ms
  liveEnd: number;     // epoch ms
  livePlaying: boolean;
  livePlayingStartedAt: number | null;
  setLiveBounds: (start: number, end: number) => void;
  setLivePlayhead: (ms: number) => void;
  setLivePlaying: (v: boolean) => void;
  currentLivePlayhead: () => number;

  // selected camera in live mode
  selectedCameraIds: string[];
  toggleSelectedCamera: (id: string) => void;
  setSelectedCameras: (ids: string[]) => void;

  // showcase /event demo (full-bleed)
  uiMode: UiMode;
  setUiMode: (m: UiMode) => void;
  /** Camera id → floating video panel is shown */
  showcaseVideoOpen: Record<string, boolean>;
  setShowcaseVideoOpen: (id: string, open: boolean) => void;
  toggleShowcaseVideoOpen: (id: string) => void;
  /** Last click position on map (container px) for smart panel spawn */
  showcasePinClickPx: { id: string; x: number; y: number } | null;
  setShowcasePinClickPx: (v: AppState["showcasePinClickPx"]) => void;
  showcasePanelRect: Record<string, ShowcasePanelRect>;
  setShowcasePanelRect: (id: string, rect: ShowcasePanelRect) => void;
  /** Map px — animate floating panel scaling from pin (cleared after animation) */
  showcasePanelSpawnAnchor: Record<string, { x: number; y: number }>;
  setShowcasePanelSpawnAnchor: (id: string, anchor: { x: number; y: number } | null) => void;
  /** Map style + layers ready (first stable idle) — used by /demo loader */
  showcaseMapReady: boolean;
  setShowcaseMapReady: (v: boolean) => void;
  /** Opening fly-through — disable pan/zoom and chrome until intro completes */
  showcaseIntroLocked: boolean;
  setShowcaseIntroLocked: (v: boolean) => void;
  /** Temporarily hide floating clips (positions preserved) */
  showcaseFloatingVideosHidden: boolean;
  toggleShowcaseFloatingVideosHidden: () => void;
  /** Reset floating UI when leaving showcase */
  resetShowcaseUi: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  fromDate: daysAgo(30),
  toDate: endOfDay(new Date()),
  setRange: (from, to) => set({ fromDate: startOfDay(from), toDate: endOfDay(to) }),

  mediaItems: [],
  setMediaItems: (items) => set({ mediaItems: items }),

  viewport: { center: [-93.27, 44.95], zoom: 3 },
  setViewport: (v) => set({ viewport: v }),

  flyTarget: null,
  flyTo: (target) =>
    set((s) => ({
      flyTarget: {
        center: target.center,
        zoom: target.zoom,
        bounds: target.bounds,
        duration: target.duration,
        bumpId: (s.flyTarget?.bumpId ?? 0) + 1
      }
    })),

  stories: [],
  setStories: (s) => set({ stories: s }),
  selectedStoryId: null,
  setSelectedStoryId: (id) => set({ selectedStoryId: id }),
  storyMediaCache: {},
  setStoryMedia: (id, items) =>
    set((s) => ({ storyMediaCache: { ...s.storyMediaCache, [id]: items } })),

  prettiOverlayItems: [],
  setPrettiOverlayItems: (items) => set({ prettiOverlayItems: items }),

  liveMode: false,
  setLiveMode: (v) => set({ liveMode: v }),
  livePlayhead: 0,
  liveStart: 0,
  liveEnd: 0,
  livePlaying: false,
  livePlayingStartedAt: null,
  setLiveBounds: (start, end) => set({ liveStart: start, liveEnd: end, livePlayhead: 0, livePlayingStartedAt: null }),
  setLivePlayhead: (ms) =>
    set((s) => ({
      livePlayhead: Math.min(Math.max(0, ms), Math.max(0, s.liveEnd - s.liveStart)),
      livePlayingStartedAt: s.livePlaying ? performance.now() : null
    })),
  setLivePlaying: (v) =>
    set((s) => {
      if (v === s.livePlaying) return {};
      if (v) return { livePlaying: true, livePlayingStartedAt: performance.now() };
      const elapsed = s.livePlayingStartedAt == null ? 0 : performance.now() - s.livePlayingStartedAt;
      return {
        livePlaying: false,
        livePlayingStartedAt: null,
        livePlayhead: Math.min(s.livePlayhead + elapsed, Math.max(0, s.liveEnd - s.liveStart))
      };
    }),
  currentLivePlayhead: () => {
    const s = get();
    const total = Math.max(0, s.liveEnd - s.liveStart);
    if (!s.livePlaying || s.livePlayingStartedAt == null) return Math.min(s.livePlayhead, total);
    return Math.min(s.livePlayhead + performance.now() - s.livePlayingStartedAt, total);
  },

  selectedCameraIds: [],
  toggleSelectedCamera: (id) =>
    set((s) => {
      const removing = s.selectedCameraIds.includes(id);
      const selectedCameraIds = removing
        ? s.selectedCameraIds.filter((x) => x !== id)
        : [...s.selectedCameraIds, id];
      if (!removing || s.uiMode !== "showcase") {
        return { selectedCameraIds };
      }
      const nextAnchor = { ...s.showcasePanelSpawnAnchor };
      delete nextAnchor[id];
      return {
        selectedCameraIds,
        showcaseVideoOpen: { ...s.showcaseVideoOpen, [id]: false },
        showcasePanelSpawnAnchor: nextAnchor
      };
    }),
  setSelectedCameras: (ids) =>
    set((s) => {
      if (s.uiMode !== "showcase") return { selectedCameraIds: ids };
      const nextSet = new Set(ids);
      let showcaseVideoOpen = s.showcaseVideoOpen;
      let showcasePanelSpawnAnchor = s.showcasePanelSpawnAnchor;
      let touched = false;
      for (const id of s.selectedCameraIds) {
        if (!nextSet.has(id) && (s.showcaseVideoOpen[id] || s.showcasePanelSpawnAnchor[id])) {
          if (!touched) {
            showcaseVideoOpen = { ...s.showcaseVideoOpen };
            showcasePanelSpawnAnchor = { ...s.showcasePanelSpawnAnchor };
            touched = true;
          }
          showcaseVideoOpen[id] = false;
          delete showcasePanelSpawnAnchor[id];
        }
      }
      return touched
        ? { selectedCameraIds: ids, showcaseVideoOpen, showcasePanelSpawnAnchor }
        : { selectedCameraIds: ids };
    }),

  uiMode: "product",
  setUiMode: (m) => set({ uiMode: m }),

  showcaseVideoOpen: {},
  setShowcaseVideoOpen: (id, open) =>
    set((s) => {
      const showcaseVideoOpen = { ...s.showcaseVideoOpen, [id]: open };
      if (open) return { showcaseVideoOpen };
      const nextAnchor = { ...s.showcasePanelSpawnAnchor };
      delete nextAnchor[id];
      return { showcaseVideoOpen, showcasePanelSpawnAnchor: nextAnchor };
    }),
  toggleShowcaseVideoOpen: (id) =>
    set((s) => {
      const next = !s.showcaseVideoOpen[id];
      return { showcaseVideoOpen: { ...s.showcaseVideoOpen, [id]: next } };
    }),

  showcasePinClickPx: null,
  setShowcasePinClickPx: (v) => set({ showcasePinClickPx: v }),

  showcasePanelRect: {},
  setShowcasePanelRect: (id, rect) =>
    set((s) => ({
      showcasePanelRect: { ...s.showcasePanelRect, [id]: rect }
    })),

  showcasePanelSpawnAnchor: {},
  setShowcasePanelSpawnAnchor: (id, anchor) =>
    set((s) => {
      const next = { ...s.showcasePanelSpawnAnchor };
      if (anchor == null) delete next[id];
      else next[id] = anchor;
      return { showcasePanelSpawnAnchor: next };
    }),

  showcaseMapReady: false,
  setShowcaseMapReady: (v) => set({ showcaseMapReady: v }),

  showcaseIntroLocked: false,
  setShowcaseIntroLocked: (v) => set({ showcaseIntroLocked: v }),

  showcaseFloatingVideosHidden: false,
  toggleShowcaseFloatingVideosHidden: () =>
    set((s) => ({ showcaseFloatingVideosHidden: !s.showcaseFloatingVideosHidden })),

  resetShowcaseUi: () =>
    set({
      showcaseVideoOpen: {},
      showcasePinClickPx: null,
      showcasePanelRect: {},
      showcasePanelSpawnAnchor: {},
      showcaseFloatingVideosHidden: false,
      showcaseIntroLocked: false
    })
}));
