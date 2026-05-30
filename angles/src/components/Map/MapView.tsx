import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import maplibregl, { Map as MLMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/state/store";
import type { MediaMapItem, UserMedia } from "@/lib/types";
import { darkStyleURL } from "./mapStyle";
import { palette } from "@/styles/tokens";
import { poseAt, type Pose } from "@/lib/pose";
import { isMockExcludedMediaId, mapPinThumbnailUrl } from "@/lib/demo";
import { cameraAccentColor } from "@/lib/cameraColors";
import { clipDurationMs } from "@/lib/livePlayback";

const SOURCE_ID = "media";
const CLUSTER_LAYER = "media-cluster";
const POINT_LAYER = "media-point";
const LIVE_LAYER = "media-live";
const LIVE_CAM_SOURCE = "live-cameras";
const LIVE_CAM_CIRCLE = "live-cam-circle";
const LIVE_CAM_ARROW = "live-cam-arrow";
const LIVE_VIEW_CONE_IMAGE = "live-view-cone";

const LIVE_PRE_ROLL_MS = 10_000;
const LIVE_DOT_INACTIVE_OPACITY = 0.3;

function applyShowcaseMapInteractions(map: MLMap, enabled: boolean) {
  const toggle = (handler: { disable: () => void; enable: () => void }) => {
    try {
      if (enabled) handler.enable();
      else handler.disable();
    } catch {
      /* ignore */
    }
  };
  toggle(map.dragPan);
  toggle(map.scrollZoom);
  toggle(map.dragRotate);
  toggle(map.keyboard);
  toggle(map.doubleClickZoom);
  toggle(map.boxZoom);
  toggle(map.touchZoomRotate);
  toggle(map.touchPitch);
  // Cooperative gestures require ⌘/Ctrl + scroll to zoom; keep plain scroll zoom instead.
  try {
    map.cooperativeGestures.disable();
  } catch {
    /* ignore */
  }
}
const LIVE_DOT_ACTIVE_FILL_OPACITY = 0.92;
const LIVE_DOT_ACTIVE_STROKE_OPACITY = 0.95;

/** Dot fill/stroke opacities and whether the view cone is shown (only while playhead is inside the clip). */
function liveDotVisualState(tMs: number, lastT: number): {
  fill: number;
  stroke: number;
  in_clip: 0 | 1;
} {
  if (tMs >= 0 && tMs <= lastT) {
    return {
      fill: LIVE_DOT_ACTIVE_FILL_OPACITY,
      stroke: LIVE_DOT_ACTIVE_STROKE_OPACITY,
      in_clip: 1
    };
  }
  if (tMs > lastT) {
    return {
      fill: LIVE_DOT_INACTIVE_OPACITY,
      stroke: LIVE_DOT_INACTIVE_OPACITY,
      in_clip: 0
    };
  }
  if (tMs <= -LIVE_PRE_ROLL_MS) {
    return {
      fill: LIVE_DOT_INACTIVE_OPACITY,
      stroke: LIVE_DOT_INACTIVE_OPACITY,
      in_clip: 0
    };
  }
  const u = (tMs + LIVE_PRE_ROLL_MS) / LIVE_PRE_ROLL_MS;
  return {
    fill: LIVE_DOT_INACTIVE_OPACITY + (LIVE_DOT_ACTIVE_FILL_OPACITY - LIVE_DOT_INACTIVE_OPACITY) * u,
    stroke: LIVE_DOT_INACTIVE_OPACITY + (LIVE_DOT_ACTIVE_STROKE_OPACITY - LIVE_DOT_INACTIVE_OPACITY) * u,
    in_clip: 0
  };
}

/** Non-live pins sit where live mode starts: first pose along `samples` (same as `poseAt(..., 0)`). */
function mapPinLatLon(m: UserMedia): { lat: number; lon: number } {
  if (m.samples?.length) {
    const pose = poseAt(m.samples, 0);
    if (pose) return { lat: pose.lat, lon: pose.lon };
  }
  return { lat: m.lat, lon: m.lon };
}

function toGeoJSON(items: MediaMapItem[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((m) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [m.lon, m.lat] },
      properties: {
        id: m.id,
        thumbnail_url: m.thumbnail_url,
        heading: m.heading,
        captured_at: m.captured_at,
        story_id: m.story_id ?? ""
      }
    }))
  };
}

type AnnotationGroup = MediaMapItem & { count: number; x: number; y: number };

type PinPreviewFn = (props: { id: string; thumbnail_url: string; captured_at: string }, coords: [number, number]) => void;

const ANNOTATION_MAX = 80;

/** Recluster only when zoom crosses these steps so merge/split doesn’t flip every frame. */
function annotationZoomBucket(z: number): number {
  if (!Number.isFinite(z)) return -999;
  return Math.floor(z * 2) / 2;
}

function mergedDataSignature(items: MediaMapItem[]): string {
  return [...items]
    .map((x) => `${x.id}:${x.lat.toFixed(6)}:${x.lon.toFixed(6)}`)
    .sort()
    .join("|");
}

function selectAnnotationCandidates(map: MLMap, items: MediaMapItem[]): MediaMapItem[] {
  const b = map.getBounds();
  const w = b.getWest();
  const e = b.getEast();
  const s = b.getSouth();
  const n = b.getNorth();
  const lonSpan = Math.abs(e - w);
  const latSpan = Math.abs(n - s);
  const lonPad =
    Number.isFinite(lonSpan) && lonSpan > 0 ? Math.max(1, lonSpan * 0.35) : 2;
  const latPad =
    Number.isFinite(latSpan) && latSpan > 0 ? Math.max(1, latSpan * 0.35) : 2;

  const finite = items.filter((m) => Number.isFinite(m.lon) && Number.isFinite(m.lat));
  let toGroup = finite.filter(
    (m) =>
      m.lon >= w - lonPad &&
      m.lon <= e + lonPad &&
      m.lat >= s - latPad &&
      m.lat <= n + latPad
  );
  if (toGroup.length === 0 && finite.length > 0) {
    toGroup = finite.slice(0, ANNOTATION_MAX);
  } else {
    toGroup = toGroup.slice(0, 500);
  }
  return toGroup;
}

function groupAnnotationMarkers(
  map: MLMap,
  items: MediaMapItem[]
): Array<MediaMapItem & { count: number; x: number; y: number }> {
  const radius = 80;
  const groups: Array<MediaMapItem & { count: number; x: number; y: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = map.project([item.lon, item.lat]);
    // During pan/inertia, project can briefly be non-finite — skipping all rows cleared every pin.
    let px = p.x;
    let py = p.y;
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      px = i * 1e6;
      py = 0;
    }
    const existing = groups.find((g) => Math.hypot(g.x - px, g.y - py) < radius);
    if (existing) {
      existing.count += 1;
      existing.lon = (existing.lon * (existing.count - 1) + item.lon) / existing.count;
      existing.lat = (existing.lat * (existing.count - 1) + item.lat) / existing.count;
      existing.x = (existing.x * (existing.count - 1) + px) / existing.count;
      existing.y = (existing.y * (existing.count - 1) + py) / existing.count;
    } else {
      groups.push({ ...item, count: 1, x: px, y: py });
    }
  }
  return groups.sort((a, b) => b.count - a.count);
}

function buildMapKitAnnotationElement(
  g: AnnotationGroup,
  onSelect: PinPreviewFn,
  onGroupTap: (center: [number, number]) => void
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "veriloc-annotation";
  btn.setAttribute("aria-label", g.count > 1 ? `${g.count} media at this place` : "Media pin");

  const body = document.createElement("div");
  body.className = "veriloc-annotation__body";

  const face = document.createElement("div");
  face.className = "veriloc-annotation__face";

  const ph = document.createElement("div");
  ph.className = "veriloc-annotation__placeholder";
  ph.innerHTML = PHOTO_GLYPH_SVG;
  ph.setAttribute("aria-hidden", "true");

  if (g.count > 1) {
    const badge = document.createElement("span");
    badge.className = "veriloc-annotation__badge";
    badge.textContent = g.count > 99 ? "99+" : String(g.count);
    face.appendChild(badge);
  }

  face.appendChild(ph);
  body.appendChild(face);

  const beak = document.createElement("div");
  beak.className = "veriloc-annotation__beak";
  body.appendChild(beak);
  btn.appendChild(body);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const c: [number, number] = [g.lon, g.lat];
    if (g.count > 1) {
      onGroupTap(c);
    } else {
      onSelect({ id: g.id, thumbnail_url: g.thumbnail_url, captured_at: g.captured_at }, c);
    }
  });
  return btn;
}

// Semi-transparent "picture" icon (mountains + sun) like MapKit placeholder
const PHOTO_GLYPH_SVG = `<svg class="veriloc-annotation__glyph" viewBox="0 0 40 32" width="40" height="32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="4" y="6" width="32" height="24" rx="2.5" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
  <circle cx="25" cy="12" r="2.2" fill="rgba(255,255,255,0.4)"/>
  <path d="M8 24 L14 16 L20 20 L24 15 L32 24 Z" fill="rgba(255,255,255,0.35)"/>
  <path d="M8 24h24v2H8z" fill="rgba(255,255,255,0.12)"/>
</svg>`;

function clearAnnotationMarkers(markersRef: MutableRefObject<maplibregl.Marker[]>): void {
  for (const m of markersRef.current) m.remove();
  markersRef.current = [];
}

type AnnotationStableRef = MutableRefObject<{
  zoomBucket: number;
  toGroupKey: string;
  dataSig: string;
}>;

function syncMapKitAnnotations(
  map: MLMap,
  items: MediaMapItem[],
  liveMode: boolean,
  _signatureRef: MutableRefObject<string>,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  onPreview: PinPreviewFn,
  stableRef: AnnotationStableRef | null
): void {
  if (liveMode || !map.isStyleLoaded() || useApp.getState().uiMode === "showcase") {
    _signatureRef.current = "";
    clearAnnotationMarkers(markersRef);
    if (stableRef) {
      stableRef.current.zoomBucket = -999;
      stableRef.current.toGroupKey = "";
      stableRef.current.dataSig = "";
    }
    return;
  }

  const raw = selectAnnotationCandidates(map, items);
  const toGroup = [...raw].sort((a, b) => a.id.localeCompare(b.id));
  let groups = groupAnnotationMarkers(map, toGroup).slice(0, ANNOTATION_MAX);
  if (groups.length === 0 && toGroup.length > 0) {
    groups = toGroup.slice(0, ANNOTATION_MAX).map((m) => ({ ...m, count: 1, x: 0, y: 0 }));
  }

  clearAnnotationMarkers(markersRef);
  _signatureRef.current = [...groups]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => `${g.id}:${g.count}:${g.lon.toFixed(5)}:${g.lat.toFixed(5)}`)
    .join("|");

  markersRef.current = groups.map((g) => {
    const el = buildMapKitAnnotationElement(
      g,
      onPreview,
      (center) => {
        map.easeTo({ center, zoom: Math.min(map.getZoom() + 2.2, 19), duration: 480 });
      }
    );
    el.style.zIndex = "10";
    return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([g.lon, g.lat]).addTo(map);
  });

  if (stableRef) {
    const candidates = selectAnnotationCandidates(map, items);
    stableRef.current.zoomBucket = annotationZoomBucket(map.getZoom());
    stableRef.current.toGroupKey = candidates.map((x) => x.id).sort().join(",");
    stableRef.current.dataSig = mergedDataSignature(items);
  }
}

type MergedRef = { merged: MediaMapItem[]; liveMode: boolean };

function pushMergedToMap(
  map: MLMap,
  merged: MediaMapItem[],
  liveMode: boolean,
  sigRef: MutableRefObject<string>,
  markersRef: MutableRefObject<maplibregl.Marker[]>,
  onPreview: PinPreviewFn,
  stableRef: AnnotationStableRef | null
): void {
  const apply = () => {
    if (!map.isStyleLoaded()) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(toGeoJSON(merged));
    syncMapKitAnnotations(map, merged, liveMode, sigRef, markersRef, onPreview, stableRef);
  };
  apply();
  // Source is created in `load`; merge effect can run earlier. Catch missed `idle` with fallbacks.
  if (!map.getSource(SOURCE_ID)) {
    map.once("idle", apply);
    map.once("styledata", apply);
    window.setTimeout(apply, 0);
    window.setTimeout(apply, 200);
  }
}

type MapLayerEvents = {
  clusterClick: (e: maplibregl.MapLayerMouseEvent) => void;
  pointClick: (e: maplibregl.MapLayerMouseEvent) => void;
  enterPt: () => void;
  leavePt: () => void;
  enterCl: () => void;
  leaveCl: () => void;
  liveCamCircleClick?: (e: maplibregl.MapLayerMouseEvent) => void;
};

function detachMapLayerEvents(map: MLMap, ev: MapLayerEvents | undefined): void {
  if (!ev) return;
  map.off("click", CLUSTER_LAYER, ev.clusterClick);
  map.off("click", POINT_LAYER, ev.pointClick);
  map.off("mouseenter", POINT_LAYER, ev.enterPt);
  map.off("mouseleave", POINT_LAYER, ev.leavePt);
  map.off("mouseenter", CLUSTER_LAYER, ev.enterCl);
  map.off("mouseleave", CLUSTER_LAYER, ev.leaveCl);
  if (ev.liveCamCircleClick) map.off("click", LIVE_CAM_CIRCLE, ev.liveCamCircleClick);
}

function mediaMapItemToUserMedia(mapItem: MediaMapItem): UserMedia {
  return {
    id: mapItem.id,
    file_url: "",
    thumbnail_url: mapItem.thumbnail_url,
    lat: mapItem.lat,
    lon: mapItem.lon,
    altitude: 0,
    captured_at: mapItem.captured_at,
    heading: mapItem.heading,
    hash: "",
    upvotes: 0,
    downvotes: 0,
    view_count: 0
  };
}

function resolveLiveUserMedia(
  s: {
    prettiOverlayItems: UserMedia[];
    storyMediaCache: Record<string, UserMedia[]>;
    mediaItems: MediaMapItem[];
  },
  id: string
): UserMedia | undefined {
  const p = s.prettiOverlayItems.find((x) => x.id === id);
  if (p) return p;
  for (const items of Object.values(s.storyMediaCache)) {
    const m = items.find((x) => x.id === id);
    if (m) return m;
  }
  const mapItem = s.mediaItems.find((x) => x.id === id);
  if (mapItem) return mediaMapItemToUserMedia(mapItem);
  return undefined;
}

/** Same as resolveLiveUserMedia, plus merged map pins (overlay clips not yet in store slices). */
function resolveLiveUserMediaFull(
  s: {
    prettiOverlayItems: UserMedia[];
    storyMediaCache: Record<string, UserMedia[]>;
    mediaItems: MediaMapItem[];
  },
  id: string,
  merged: MediaMapItem[]
): UserMedia | undefined {
  const direct = resolveLiveUserMedia(s, id);
  if (direct) return direct;
  const mm = merged.find((x) => x.id === id);
  return mm ? mediaMapItemToUserMedia(mm) : undefined;
}

function pushLiveCameraFeature(opts: {
  id: string;
  pose: Pose;
  in_clip: 0 | 1;
  fill: number;
  stroke: number;
  coneAlpha: number;
}): GeoJSON.Feature {
  const { id, pose, in_clip, fill, stroke, coneAlpha } = opts;
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [pose.lon, pose.lat] },
    properties: {
      id,
      heading: pose.heading,
      color: cameraAccentColor(id),
      in_clip,
      circle_opacity: fill,
      circle_stroke_opacity: stroke,
      cone_alpha: coneAlpha
    }
  };
}

function buildLiveCameraFeatures(
  s: {
    liveMode: boolean;
    selectedCameraIds: string[];
    liveStart: number;
    prettiOverlayItems: UserMedia[];
    storyMediaCache: Record<string, UserMedia[]>;
    mediaItems: MediaMapItem[];
    currentLivePlayhead: () => number;
    uiMode: "product" | "showcase";
    showcaseVideoOpen: Record<string, boolean | undefined>;
  },
  merged: MediaMapItem[]
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];
  if (!s.liveMode || s.selectedCameraIds.length === 0) return features;
  const showcase = s.uiMode === "showcase";
  const vidOpen = s.showcaseVideoOpen;
  const absoluteMs = s.liveStart + s.currentLivePlayhead();
  for (const id of s.selectedCameraIds) {
    if (isMockExcludedMediaId(id)) continue;
    const m = resolveLiveUserMediaFull(s, id, merged);
    if (!m) continue;
    const t0 = new Date(m.captured_at).getTime();
    const tMs = absoluteMs - t0;
    const lastT = clipDurationMs(m);

    let pose: Pose | null;

    if (showcase) {
      if (tMs < 0 || tMs > lastT) continue;
      const floating = !!vidOpen[id];
      const dotDim = floating ? 1 : 0.32;
      const strokeDim = floating ? 1 : 0.38;
      const coneAlpha = floating ? 1 : 0.42;

      let p: Pose;
      if (!m.samples?.length) {
        p = { lat: m.lat, lon: m.lon, heading: m.heading, altitude: m.altitude };
      } else {
        const got = poseAt(m.samples, Math.max(0, Math.min(tMs, lastT)));
        if (!got) continue;
        p = got;
      }
      features.push(
        pushLiveCameraFeature({
          id,
          pose: p,
          in_clip: 1,
          fill: LIVE_DOT_ACTIVE_FILL_OPACITY * dotDim,
          stroke: LIVE_DOT_ACTIVE_STROKE_OPACITY * strokeDim,
          coneAlpha
        })
      );
      continue;
    }

    const vis = liveDotVisualState(tMs, lastT);

    if (!m.samples?.length) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [m.lon, m.lat] },
        properties: {
          id,
          heading: m.heading,
          color: cameraAccentColor(id),
          in_clip: vis.in_clip,
          circle_opacity: vis.fill,
          circle_stroke_opacity: vis.stroke,
          cone_alpha: 1
        }
      });
      continue;
    }

    if (tMs < 0) {
      pose = poseAt(m.samples, 0);
    } else if (tMs > lastT) {
      pose = poseAt(m.samples, lastT);
    } else {
      pose = poseAt(m.samples, tMs);
    }
    if (!pose) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pose.lon, pose.lat] },
      properties: {
        id,
        heading: pose.heading,
        color: cameraAccentColor(id),
        in_clip: vis.in_clip,
        circle_opacity: vis.fill,
        circle_stroke_opacity: vis.stroke,
        cone_alpha: 1
      }
    });
  }
  return features;
}

function syncLiveCameraGeoJSON(map: MLMap, merged: MediaMapItem[]): void {
  const liveSrc = map.getSource(LIVE_CAM_SOURCE) as GeoJSONSource | undefined;
  if (!liveSrc) return;
  const s = useApp.getState();
  if (!s.liveMode || s.selectedCameraIds.length === 0) {
    liveSrc.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  liveSrc.setData({
    type: "FeatureCollection",
    features: buildLiveCameraFeatures(
      {
        liveMode: s.liveMode,
        selectedCameraIds: s.selectedCameraIds,
        liveStart: s.liveStart,
        prettiOverlayItems: s.prettiOverlayItems,
        storyMediaCache: s.storyMediaCache,
        mediaItems: s.mediaItems,
        currentLivePlayhead: s.currentLivePlayhead,
        uiMode: s.uiMode,
        showcaseVideoOpen: s.showcaseVideoOpen
      },
      merged
    )
  });
}

function applyLiveCameraRingHighlight(map: MLMap, selectedCameraIds: string[]): void {
  if (!map.getLayer(LIVE_LAYER)) return;
  if (useApp.getState().uiMode === "showcase") {
    map.setPaintProperty(LIVE_LAYER, "circle-opacity", 0);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-opacity", 0);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-color", palette.liveDot);
    map.setFilter(LIVE_LAYER, ["!", ["has", "point_count"]]);
    return;
  }
  if (selectedCameraIds.length === 0) {
    map.setPaintProperty(LIVE_LAYER, "circle-opacity", 0);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-opacity", 0);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-color", palette.liveDot);
    map.setFilter(LIVE_LAYER, ["!", ["has", "point_count"]]);
  } else {
    const matchExpr: (string | (string | unknown)[])[] = ["match", ["get", "id"]];
    for (const id of selectedCameraIds) {
      matchExpr.push(id, cameraAccentColor(id));
    }
    matchExpr.push(palette.liveDot);
    map.setPaintProperty(LIVE_LAYER, "circle-opacity", 0.0);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-opacity", 0.55);
    map.setPaintProperty(LIVE_LAYER, "circle-stroke-color", matchExpr as never);
    map.setFilter(LIVE_LAYER, [
      "all",
      ["!", ["has", "point_count"]],
      ["in", ["get", "id"], ["literal", selectedCameraIds]]
    ]);
  }
}

let cachedLiveViewConeImage: ImageData | null = null;
async function getCachedLiveViewConeImage(): Promise<ImageData> {
  if (!cachedLiveViewConeImage) cachedLiveViewConeImage = await makeLiveViewConeImage();
  return cachedLiveViewConeImage;
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const mergedRef = useRef<MergedRef>({ merged: [], liveMode: false });
  const annotationSigRef = useRef("");
  const annotationMarkersRef = useRef<maplibregl.Marker[]>([]);
  const annotationStableRef = useRef({
    zoomBucket: -999,
    toGroupKey: "",
    dataSig: ""
  });
  const pinPreviewRef = useRef<PinPreviewFn>(() => {});
  const layerEventsRef = useRef<MapLayerEvents | undefined>(undefined);
  const styleInstallGenRef = useRef(0);
  const liveCamCircleHandlerRef = useRef<((e: maplibregl.MapLayerMouseEvent) => void) | undefined>(undefined);
  const mediaItems = useApp((s) => s.mediaItems);
  const prettiOverlayItems = useApp((s) => s.prettiOverlayItems);
  const flyTarget = useApp((s) => s.flyTarget);
  const liveMode = useApp((s) => s.liveMode);
  const selectedStoryId = useApp((s) => s.selectedStoryId);
  const storyMediaCache = useApp((s) => s.storyMediaCache);
  const setSelectedCameras = useApp((s) => s.setSelectedCameras);
  const selectedCameraIds = useApp((s) => s.selectedCameraIds);
  const setViewport = useApp((s) => s.setViewport);
  const setLiveBounds = useApp((s) => s.setLiveBounds);
  const setLiveMode = useApp((s) => s.setLiveMode);
  const uiMode = useApp((s) => s.uiMode);
  const showcaseIntroLocked = useApp((s) => s.showcaseIntroLocked);
  const showcaseVideoOpen = useApp((s) => s.showcaseVideoOpen);

  const openMapPreview = useCallback<PinPreviewFn>(
    (props, coords) => {
      const map = mapRef.current;
      if (!map) return;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        className: "mapkit-preview",
        offset: [0, -32],
        maxWidth: "280px"
      })
        .setLngLat(coords)
        .setHTML(
          (() => {
            const thumb = mapPinThumbnailUrl(props.thumbnail_url);
            const thumbEl = thumb
              ? `<img class="mapkit-preview-thumb" src="${escapeHtml(thumb)}" alt="" />`
              : `<div class="mapkit-preview-thumb mapkit-preview-thumb--empty" aria-hidden="true"></div>`;
            return `<div class="mapkit-preview-card">
             ${thumbEl}
             <div class="mapkit-preview-body">
               <div class="mapkit-preview-title">Verified media</div>
               <div class="mapkit-preview-time">${escapeHtml(formatPreviewTime(props.captured_at))}</div>
             </div>
           </div>`;
          })()
        )
        .addTo(map);
      if (useApp.getState().liveMode && useApp.getState().uiMode !== "showcase") {
        setSelectedCameras([props.id]);
      }
    },
    [setSelectedCameras]
  );

  useEffect(() => {
    pinPreviewRef.current = openMapPreview;
  }, [openMapPreview]);

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: darkStyleURL,
      center: [-93.27, 44.95],
      zoom: 3,
      attributionControl: { compact: true }
    });
    map.on("styleimagemissing", (e) => {
      const id = e.id;
      if (map.hasImage(id)) return;
      try {
        map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
      } catch {
        /* ignore — e.g. SDF vs raster mismatch on some IDs */
      }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: "metric" }), "bottom-left");

    let annotationMoveDebounce: number | undefined;

    const installCustomLayers = async () => {
      const gen = ++styleInstallGenRef.current;
      const img = await getCachedLiveViewConeImage();
      if (gen !== styleInstallGenRef.current) return;

      const finish = () => {
        // Never gate on `gen` here: this function is scheduled on future `idle`/`load`; a newer
        // installCustomLayers() bumps `gen`, and bailing prevented layers + showcase readiness from running.
        if (mapRef.current !== map) return;
        if (!map.isStyleLoaded()) {
          map.once("idle", finish);
          return;
        }

      if (!map.getSource(SOURCE_ID)) {
        detachMapLayerEvents(map, layerEventsRef.current);
        layerEventsRef.current = undefined;

        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: true,
          clusterRadius: 55,
          clusterMaxZoom: 12
        });

        map.addLayer({
          id: CLUSTER_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": palette.accent,
            "circle-stroke-color": "rgba(0,0,0,0.45)",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 20, 10, 24, 50, 30, 100, 36],
            "circle-opacity": 0.95
          }
        });

        map.addLayer({
          id: POINT_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#ffffff",
            "circle-radius": 12,
            "circle-stroke-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 1,
            "circle-opacity": 0
          }
        });

        map.addLayer({
          id: LIVE_LAYER,
          type: "circle",
          source: SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": palette.liveDot,
            "circle-radius": 10,
            "circle-opacity": 0,
            "circle-stroke-color": palette.liveDot,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0
          }
        });

        const clusterClick = (e: maplibregl.MapLayerMouseEvent) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const clusterId = feat.properties?.cluster_id;
          const src0 = map.getSource(SOURCE_ID) as GeoJSONSource;
          if (clusterId == null) return;
          src0.getClusterExpansionZoom(clusterId as number).then((z) => {
            const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coords, zoom: z, duration: 600 });
          });
        };

        const pointClick = (e: maplibregl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties as { id: string; thumbnail_url: string; captured_at: string };
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          pinPreviewRef.current(props, coords);
        };

        const pointer = (on: boolean) => () => {
          map.getCanvas().style.cursor = on ? "pointer" : "";
        };
        const enterPt = pointer(true);
        const leavePt = pointer(false);
        const enterCl = pointer(true);
        const leaveCl = pointer(false);

        map.on("click", CLUSTER_LAYER, clusterClick);
        map.on("click", POINT_LAYER, pointClick);
        map.on("mouseenter", POINT_LAYER, enterPt);
        map.on("mouseleave", POINT_LAYER, leavePt);
        map.on("mouseenter", CLUSTER_LAYER, enterCl);
        map.on("mouseleave", CLUSTER_LAYER, leaveCl);

        layerEventsRef.current = { clusterClick, pointClick, enterPt, leavePt, enterCl, leaveCl };
      }

      if (!map.hasImage(LIVE_VIEW_CONE_IMAGE)) {
        try {
          map.addImage(LIVE_VIEW_CONE_IMAGE, img, { sdf: true });
        } catch {
          map.addImage(LIVE_VIEW_CONE_IMAGE, img, { sdf: false });
        }
      }
      if (!map.getSource(LIVE_CAM_SOURCE)) {
        map.addSource(LIVE_CAM_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] }
        });
      }
      if (!map.getLayer(LIVE_CAM_CIRCLE)) {
        map.addLayer({
          id: LIVE_CAM_CIRCLE,
          type: "circle",
          source: LIVE_CAM_SOURCE,
          paint: {
            "circle-color": ["coalesce", ["get", "color"], palette.liveDot],
            "circle-radius": 12,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": ["coalesce", ["to-number", ["get", "circle_opacity"]], LIVE_DOT_INACTIVE_OPACITY],
            "circle-stroke-opacity": [
              "coalesce",
              ["to-number", ["get", "circle_stroke_opacity"]],
              LIVE_DOT_INACTIVE_OPACITY
            ]
          }
        });
      }
      if (!map.getLayer(LIVE_CAM_ARROW) && map.hasImage(LIVE_VIEW_CONE_IMAGE)) {
        map.addLayer({
          id: LIVE_CAM_ARROW,
          type: "symbol",
          source: LIVE_CAM_SOURCE,
          filter: ["==", ["to-number", ["get", "in_clip"]], 1],
          layout: {
            "icon-image": LIVE_VIEW_CONE_IMAGE,
            "icon-size": 1.12,
            "icon-rotate": ["coalesce", ["to-number", ["get", "heading"]], 0],
            "icon-rotation-alignment": "map",
            "icon-anchor": "bottom",
            "icon-offset": [0, 0],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true
          },
          paint: {
            "icon-color": ["coalesce", ["get", "color"], palette.liveDot],
            "icon-opacity": ["*", 0.45, ["coalesce", ["to-number", ["get", "cone_alpha"]], 1]]
          }
        });
      }

      const bindLiveCamShowcaseClick = () => {
        if (!map.getLayer(LIVE_CAM_CIRCLE)) return;
        const prev = liveCamCircleHandlerRef.current;
        if (prev) map.off("click", LIVE_CAM_CIRCLE, prev);
        const next = (e: maplibregl.MapLayerMouseEvent) => {
          const root = useApp.getState();
          if (root.uiMode !== "showcase") return;
          if (root.showcaseIntroLocked) return;
          const f = e.features?.[0];
          if (!f) return;
          const id = String(f.properties?.id ?? "");
          if (!id) return;
          const open = !!root.showcaseVideoOpen[id];
          if (open) {
            root.setShowcaseVideoOpen(id, false);
            return;
          }
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const p = map.project(coords);
          /** Same tick as open so FloatingPanel layout sees anchor even when rect is reused */
          root.setShowcasePanelSpawnAnchor(id, { x: p.x, y: p.y });
          root.setShowcasePinClickPx({ id, x: p.x, y: p.y });
          root.setShowcaseVideoOpen(id, true);
        };
        liveCamCircleHandlerRef.current = next;
        map.on("click", LIVE_CAM_CIRCLE, next);
      };
      bindLiveCamShowcaseClick();

      for (const lid of [LIVE_CAM_CIRCLE, LIVE_CAM_ARROW]) {
        if (map.getLayer(lid)) {
          try {
            map.moveLayer(lid);
          } catch {
            /* ignore ordering if style does not support move */
          }
        }
      }

      pushMergedToMap(
        map,
        mergedRef.current.merged,
        mergedRef.current.liveMode,
        annotationSigRef,
        annotationMarkersRef,
        (p, c) => pinPreviewRef.current(p, c),
        annotationStableRef
      );

      const st = useApp.getState();
      const archiveVis =
        st.uiMode === "showcase" ? "none" : st.liveMode ? "none" : "visible";
      for (const id of [CLUSTER_LAYER, POINT_LAYER, LIVE_LAYER]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", archiveVis);
      }
      for (const id of [LIVE_CAM_CIRCLE, LIVE_CAM_ARROW]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
      }
      if (st.liveMode) {
        clearAnnotationMarkers(annotationMarkersRef);
        annotationSigRef.current = "";
        annotationStableRef.current = { zoomBucket: -999, toGroupKey: "", dataSig: "" };
      } else {
        syncMapKitAnnotations(
          map,
          mergedRef.current.merged,
          false,
          annotationSigRef,
          annotationMarkersRef,
          (p, c) => pinPreviewRef.current(p, c),
          annotationStableRef
        );
      }
      applyLiveCameraRingHighlight(map, st.selectedCameraIds);
      syncLiveCameraGeoJSON(map, mergedRef.current.merged);

      const tryMarkShowcaseMapReady = () => {
        // Do not gate on `gen`: a newer installCustomLayers bump invalidates `gen` while this map
        // may still be current; skipping here left /demo stuck on the loading screen forever.
        if (mapRef.current !== map) return;
        const r = useApp.getState();
        if (r.uiMode !== "showcase") return;
        r.setShowcaseMapReady(true);
      };

      map.once("idle", () => {
        if (gen === styleInstallGenRef.current) {
          syncLiveCameraGeoJSON(map, mergedRef.current.merged);
        }
        requestAnimationFrame(() => {
          if (mapRef.current !== map) return;
          map.once("idle", tryMarkShowcaseMapReady);
        });
      });
      };

      finish();
    };

    map.once("load", () => {
      void installCustomLayers();
    });
    map.on("style.load", () => {
      if (!map.isStyleLoaded()) return;
      const needLiveStack =
        !map.getSource(LIVE_CAM_SOURCE) || !map.getLayer(LIVE_CAM_CIRCLE);
      if (needLiveStack) {
        void installCustomLayers();
      }
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      const b = map.getBounds();
      setViewport({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      });
      // Debounce: during scroll/inertia, bounds/project are unstable; immediate sync often produced
      // empty marker sets and cleared all pins.
      window.clearTimeout(annotationMoveDebounce);
      annotationMoveDebounce = window.setTimeout(() => {
        const m = mergedRef.current;
        if (!m.liveMode && map.isStyleLoaded()) {
          const candidates = selectAnnotationCandidates(map, m.merged);
          const toGroupKey = candidates.map((x) => x.id).sort().join(",");
          const dataSig = mergedDataSignature(m.merged);
          const zb = annotationZoomBucket(map.getZoom());
          const st = annotationStableRef.current;
          const hasDomPins = annotationMarkersRef.current.length > 0;
          if (
            hasDomPins &&
            zb === st.zoomBucket &&
            toGroupKey === st.toGroupKey &&
            dataSig === st.dataSig
          ) {
            return;
          }
        }
        syncMapKitAnnotations(
          map,
          m.merged,
          m.liveMode,
          annotationSigRef,
          annotationMarkersRef,
          (p, coords) => pinPreviewRef.current(p, coords),
          annotationStableRef
        );
      }, 140);
    });

    mapRef.current = map;
    applyShowcaseMapInteractions(
      map,
      !(useApp.getState().uiMode === "showcase" && useApp.getState().showcaseIntroLocked)
    );

    return () => {
      window.clearTimeout(annotationMoveDebounce);
      detachMapLayerEvents(map, layerEventsRef.current);
      layerEventsRef.current = undefined;
      if (liveCamCircleHandlerRef.current) {
        map.off("click", LIVE_CAM_CIRCLE, liveCamCircleHandlerRef.current);
        liveCamCircleHandlerRef.current = undefined;
      }
      clearAnnotationMarkers(annotationMarkersRef);
      annotationSigRef.current = "";
      map.remove();
      mapRef.current = null;
    };
  }, [setSelectedCameras, setViewport]);

  // push Pretti overlay into map source
  useEffect(() => {
    const merged: MediaMapItem[] = (() => {
      if (uiMode === "showcase") {
        const byId = new Map<string, MediaMapItem>();
        for (const m of prettiOverlayItems) {
          if (isMockExcludedMediaId(m.id)) continue;
          const { lat, lon } = mapPinLatLon(m);
          byId.set(m.id, {
            id: m.id,
            thumbnail_url: m.thumbnail_url,
            lat,
            lon,
            heading: m.heading,
            captured_at: m.captured_at,
            story_id: null
          });
        }
        return [...byId.values()];
      }

      const selectedStoryMedia = selectedStoryId ? (storyMediaCache[selectedStoryId] ?? []) : [];
      // Same clip can appear in both prettiOverlayItems and storyMediaCache (e.g. Pretti selected) — one marker per id.
      const overlayById = new Map<string, MediaMapItem>();
      const pushOverlay = (m: UserMedia) => {
        const { lat, lon } = mapPinLatLon(m);
        overlayById.set(m.id, {
          id: m.id,
          thumbnail_url: m.thumbnail_url,
          lat,
          lon,
          heading: m.heading,
          captured_at: m.captured_at,
          story_id: null
        });
      };
      for (const m of prettiOverlayItems) {
        if (!isMockExcludedMediaId(m.id)) pushOverlay(m);
      }
      for (const m of selectedStoryMedia) {
        if (!isMockExcludedMediaId(m.id)) pushOverlay(m);
      }
      const overlayAsMapItems = [...overlayById.values()];
      const overlayIds = new Set(overlayAsMapItems.map((x) => x.id));
      const combined = [...mediaItems.filter((x) => !overlayIds.has(x.id)), ...overlayAsMapItems];
      const byId = new Map<string, MediaMapItem>();
      for (const m of combined) {
        if (!isMockExcludedMediaId(m.id)) byId.set(m.id, m);
      }
      return [...byId.values()];
    })();

    mergedRef.current = { merged, liveMode };
    const map = mapRef.current;
    if (map) {
      pushMergedToMap(
        map,
        merged,
        liveMode,
        annotationSigRef,
        annotationMarkersRef,
        (p, c) => pinPreviewRef.current(p, c),
        annotationStableRef
      );
    }
  }, [mediaItems, prettiOverlayItems, selectedStoryId, storyMediaCache, liveMode, uiMode]);

  // fly target
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    const syncThumbnailPins = () => {
      const m = mergedRef.current;
      if (m.liveMode || !map.isStyleLoaded()) return;
      syncMapKitAnnotations(
        map,
        m.merged,
        false,
        annotationSigRef,
        annotationMarkersRef,
        (p, c) => pinPreviewRef.current(p, c),
        annotationStableRef
      );
    };
    let fallbackSync = window.setTimeout(syncThumbnailPins, 1000);
    const afterCameraMove = () => {
      window.clearTimeout(fallbackSync);
      requestAnimationFrame(() => {
        window.setTimeout(syncThumbnailPins, 0);
      });
    };
    const dur = flyTarget.duration ?? 900;
    if (flyTarget.bounds) {
      const [w, s, e, n] = flyTarget.bounds;
      map.fitBounds(
        [
          [w, s],
          [e, n]
        ],
        { padding: 80, maxZoom: flyTarget.zoom, duration: dur }
      );
    } else {
      map.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom, duration: dur });
    }
    map.once("moveend", afterCameraMove);
    return () => {
      window.clearTimeout(fallbackSync);
      map.off("moveend", afterCameraMove);
    };
  }, [flyTarget]);

  // Showcase cinematic intro — disable pan/zoom/rotation until fly chain completes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const locked = uiMode === "showcase" && showcaseIntroLocked;
    applyShowcaseMapInteractions(map, !locked);
  }, [uiMode, showcaseIntroLocked]);

  // live mode: filter visible items + set live bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (liveMode) {
      const b = map.getBounds();
      const liveItems = (
        uiMode === "showcase"
          ? prettiOverlayItems
          : prettiOverlayItems.length
            ? prettiOverlayItems
            : mediaItems
      ).filter((m) => !isMockExcludedMediaId(m.id));
      const bypassViewport =
        uiMode === "showcase" && prettiOverlayItems.filter((x) => !isMockExcludedMediaId(x.id)).length > 0;
      const inView = bypassViewport
        ? liveItems
        : liveItems.filter((m) => {
            const [lon, lat] = startCoordinate(m);
            return lon >= b.getWest() && lon <= b.getEast() && lat >= b.getSouth() && lat <= b.getNorth();
          });
      if (inView.length === 0) {
        setLiveMode(false);
        return;
      }
      const sorted = [...inView].sort(
        (a, b1) => new Date(a.captured_at).getTime() - new Date(b1.captured_at).getTime()
      );
      const start = new Date(sorted[0].captured_at).getTime();
      const end = Math.max(
        ...sorted.map((m) => {
          const captured = new Date(m.captured_at).getTime();
          const sampleEnd = clipDurationMs(m as UserMedia);
          return captured + sampleEnd;
        })
      );
      setLiveBounds(start, end);
      setSelectedCameras(sorted.map((m) => m.id));
      if (map.isStyleLoaded()) {
        syncLiveCameraGeoJSON(map, mergedRef.current.merged);
      }
    } else {
      setSelectedCameras([]);
      if (map.isStyleLoaded()) {
        syncLiveCameraGeoJSON(map, mergedRef.current.merged);
      }
    }
  }, [liveMode, mediaItems, prettiOverlayItems, uiMode, setLiveBounds, setSelectedCameras, setLiveMode]);

  // selected camera highlight (static ring around the captured_at position)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyLiveCameraRingHighlight(map, selectedCameraIds);
  }, [selectedCameraIds, uiMode]);

  // Live mode: hide archive; restore DOM pins when leaving live.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setVis = () => {
      if (popupRef.current && liveMode) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (liveMode) {
        clearAnnotationMarkers(annotationMarkersRef);
        annotationSigRef.current = "";
        annotationStableRef.current = { zoomBucket: -999, toGroupKey: "", dataSig: "" };
      }
      const root = useApp.getState();
      const archiveVis =
        root.uiMode === "showcase" ? "none" : root.liveMode ? "none" : "visible";
      for (const id of [CLUSTER_LAYER, POINT_LAYER, LIVE_LAYER]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", archiveVis);
      }
      for (const id of [LIVE_CAM_CIRCLE, LIVE_CAM_ARROW]) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
      }
      if (!liveMode) {
        const m = mergedRef.current;
        syncMapKitAnnotations(
          map,
          m.merged,
          false,
          annotationSigRef,
          annotationMarkersRef,
          (p, c) => pinPreviewRef.current(p, c),
          annotationStableRef
        );
      }
    };

    const runVis = () => {
      if (!map.isStyleLoaded()) return;
      setVis();
      syncLiveCameraGeoJSON(map, mergedRef.current.merged);
    };
    if (map.isStyleLoaded()) {
      runVis();
    } else {
      map.once("load", runVis);
    }
    map.on("style.load", runVis);
    return () => {
      map.off("load", runVis);
      map.off("style.load", runVis);
    };
  }, [liveMode, uiMode]);

  // Push live camera positions whenever selection / overlay / merge changes (not only on rAF).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncLiveCameraGeoJSON(map, mergedRef.current.merged);
  }, [liveMode, selectedCameraIds, prettiOverlayItems, mediaItems, storyMediaCache, selectedStoryId, uiMode, showcaseVideoOpen]);

  // Live rAF: smooth playhead updates for moving cameras
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let raf = 0;
    const tick = () => {
      syncLiveCameraGeoJSON(map, mergedRef.current.merged);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** /demo: rely on `idle` + several timeouts — some MapLibre setups never reach a second `idle`. */
  useEffect(() => {
    if (uiMode !== "showcase") return;

    let cancel = false;
    let idleAttached: MLMap | null = null;
    let raf = 0;
    let framesWaited = 0;
    const timeouts: number[] = [];

    const markReadyIfSurfaceUsable = () => {
      if (cancel) return;
      const m = mapRef.current;
      const st = useApp.getState();
      if (!m || st.uiMode !== "showcase") return;
      try {
        if (!m.isStyleLoaded()) return;
        if (!m.getSource(SOURCE_ID)) return;
        if (!m.getLayer(LIVE_CAM_CIRCLE)) return;
      } catch {
        return;
      }
      st.setShowcaseMapReady(true);
    };

    const onIdle = () => markReadyIfSurfaceUsable();

    const pollForMap = () => {
      if (cancel) return;
      const m = mapRef.current;
      if (m) {
        idleAttached = m;
        m.on("idle", onIdle);
        timeouts.push(window.setTimeout(markReadyIfSurfaceUsable, 260));
        timeouts.push(window.setTimeout(markReadyIfSurfaceUsable, 1400));
        timeouts.push(window.setTimeout(markReadyIfSurfaceUsable, 4400));
        timeouts.push(
          window.setTimeout(() => {
            if (cancel) return;
            const st = useApp.getState();
            if (st.uiMode !== "showcase") return;
            st.setShowcaseMapReady(true);
          }, 9200)
        );
        markReadyIfSurfaceUsable();
        return;
      }
      if (++framesWaited > 540) {
        markReadyIfSurfaceUsable();
        return;
      }
      raf = requestAnimationFrame(pollForMap);
    };

    pollForMap();

    return () => {
      cancel = true;
      cancelAnimationFrame(raf);
      if (idleAttached) idleAttached.off("idle", onIdle);
      for (const t of timeouts) clearTimeout(t);
    };
  }, [uiMode]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}

/** Wide viewing wedge; apex at bottom-center so `icon-anchor: bottom` sits the tip on the camera dot. */
async function makeLiveViewConeImage(): Promise<ImageData> {
  const w = 56;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const apexY = h - 1;
  const rimY = 5;
  const rimHalf = 25;
  ctx.beginPath();
  ctx.moveTo(cx, apexY);
  ctx.lineTo(cx - rimHalf, rimY);
  ctx.quadraticCurveTo(cx, rimY - 11, cx + rimHalf, rimY);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return ctx.getImageData(0, 0, w, h);
}

function startCoordinate(item: MediaMapItem | { lat: number; lon: number; samples?: Array<{ lat: number; lon: number }> }): [number, number] {
  const first = "samples" in item ? item.samples?.[0] : undefined;
  return [first?.lon ?? item.lon, first?.lat ?? item.lat];
}

function formatPreviewTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[ch];
  });
}
