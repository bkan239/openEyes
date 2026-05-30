import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useApp } from "@/state/store";
import type { UserMedia } from "@/lib/types";
import { clipDurationMs, clipOffsetSecondsFromWall, DEFAULT_CLIP_SECONDS } from "@/lib/livePlayback";
import { mapPinThumbnailUrl, PRETTI_STORY_ID } from "@/lib/demo";
import { cameraAccentColor } from "@/lib/cameraColors";
import {
  computeSpawnRect,
  defaultPanelWidthPx,
  panelHeightPx,
  showcasePanelOuterHeight
} from "@/components/Showcase/spawnPanelRect";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

function vwvh() {
  return {
    vw: typeof window !== "undefined" ? window.innerWidth : 1200,
    vh: typeof window !== "undefined" ? window.innerHeight : 800
  };
}

function clampFloatPanelWidth(width: number): number {
  const { vw } = vwvh();
  return Math.round(Math.min(Math.max(width, 140), Math.max(560, vw * 0.9)));
}

type ResizeCorner = "nw" | "ne" | "sw" | "se";

const FLOAT_CORNER_HIT_PX = 22;

/** Layout-only fields shared by memoized spawn frame — background comes from accentColor */
const FLOAT_PANEL_FRAME_BASE_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  boxSizing: "border-box",
  padding: 2,
  borderRadius: 14,
  boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12) inset`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

function resizeCornerCursor(c: ResizeCorner): string {
  switch (c) {
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    default:
      return "default";
  }
}

const FLOAT_CORNER_GRIP_FLEX: Record<ResizeCorner, CSSProperties> = {
  nw: { justifyContent: "flex-start", alignItems: "flex-start", left: 0, top: 0 },
  ne: { justifyContent: "flex-end", alignItems: "flex-start", right: 0, top: 0 },
  sw: { justifyContent: "flex-start", alignItems: "flex-end", left: 0, bottom: 0 },
  se: { justifyContent: "flex-end", alignItems: "flex-end", right: 0, bottom: 0 }
};

/**
 * Hatch apex sits on each corner of viewBox 0–14 (panel corner); strokes aim inward along resize diagonal.
 * NW/SW and NE/SE paths are swapped vertically so top grips match prior bottom orientation (and vice versa).
 */
const FLOAT_CORNER_GRIP_PATH: Record<ResizeCorner, string> = {
  nw: "M2 12 L12 2 M2 8 L6 2 M2 4 L10 2",
  sw: "M2 2 L12 12 M2 6 L6 12 M2 10 L10 12",
  ne: "M12 12 L2 2 M12 8 L8 2 M12 4 L4 2",
  se: "M12 2 L2 12 M12 6 L8 12 M12 10 L4 12"
};

function clampPanel(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): { left: number; top: number; width: number; height: number } {
  const { vw, vh } = vwvh();
  const MIN_VISIBLE = 80;
  const w = clampFloatPanelWidth(rect.width);
  const h = showcasePanelOuterHeight(w);
  const minLeft = -w + MIN_VISIBLE;
  const maxLeft = vw - MIN_VISIBLE;
  const minTop = -h + MIN_VISIBLE;
  const maxTop = vh - MIN_VISIBLE;
  return {
    left: Math.min(Math.max(minLeft, rect.left), maxLeft),
    top: Math.min(Math.max(minTop, rect.top), maxTop),
    width: w,
    height: h
  };
}

export function ShowcaseFloatingVideos() {
  const showcaseOpen = useApp((s) => s.showcaseVideoOpen);
  const setShowcaseVideoOpen = useApp((s) => s.setShowcaseVideoOpen);
  const setShowcasePanelRect = useApp((s) => s.setShowcasePanelRect);
  const showcasePanelRect = useApp((s) => s.showcasePanelRect);
  const showcasePinClickPx = useApp((s) => s.showcasePinClickPx);
  const setShowcasePinClickPx = useApp((s) => s.setShowcasePinClickPx);
  const showcaseFloatingVideosHidden = useApp((s) => s.showcaseFloatingVideosHidden);
  const prettiOverlayItems = useApp((s) => s.prettiOverlayItems);
  const storyMediaCache = useApp((s) => s.storyMediaCache);
  const selectedCameraIds = useApp((s) => s.selectedCameraIds);

  const hydrated = useMemo(() => {
    const map: Record<string, UserMedia> = {};
    for (const m of prettiOverlayItems) map[m.id] = m;
    const cached = storyMediaCache[PRETTI_STORY_ID];
    if (cached) {
      for (const m of cached) map[m.id] = m;
    }
    return map;
  }, [prettiOverlayItems, storyMediaCache]);

  /** Stays below demo HUD (~94–96) so timeline / map chrome stay clickable */
  const floatZPeak = useRef(50);

  const openCameraIdsKey = selectedCameraIds.filter((id) => showcaseOpen[id]).join("|");
  const openIds = selectedCameraIds.filter((id) => showcaseOpen[id]);

  useEffect(() => {
    const stRoot = useApp.getState();
    const openList = stRoot.selectedCameraIds.filter((id) => stRoot.showcaseVideoOpen[id]);
    if (!openList.length) return;

    const { vw, vh } = vwvh();
    const panelW = defaultPanelWidthPx(vw);
    const panelH = panelHeightPx(panelW);

    let pinConsumed = false;
    const existingPanels: Parameters<typeof computeSpawnRect>[0]["existing"] = [];
    const rects = stRoot.showcasePanelRect;
    const openKey = new Set(openList);
    for (const oid of Object.keys(rects)) {
      if (openKey.has(oid) && rects[oid]) existingPanels.push(rects[oid]);
    }

    const pinPx = showcasePinClickPx;

    for (const id of openList) {
      const pin = pinPx?.id === id ? { x: pinPx.x, y: pinPx.y } : null;
      if (pin) {
        pinConsumed = true;
        useApp.getState().setShowcasePanelSpawnAnchor(id, { x: pin.x, y: pin.y });
      }

      if (stRoot.showcasePanelRect[id]) continue;

      const spawn = computeSpawnRect({
        viewportW: vw,
        viewportH: vh,
        panelW,
        panelH,
        pin,
        existing: existingPanels
      });
      const snapped = clampPanel(spawn);
      setShowcasePanelRect(id, snapped);
      existingPanels.push(snapped);
    }

    if (pinConsumed) setShowcasePinClickPx(null);
  }, [openCameraIdsKey, showcasePinClickPx, setShowcasePanelRect, setShowcasePinClickPx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const st = useApp.getState();
      const vis = [...st.selectedCameraIds].filter((x) => st.showcaseVideoOpen[x]);
      if (!vis.length) return;
      const vid = vis[vis.length - 1];
      st.setShowcaseVideoOpen(vid, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bumpGlobalZ = (): number => {
    floatZPeak.current = Math.min(floatZPeak.current + 1, 88);
    return floatZPeak.current;
  };

  if (!openIds.length) return null;

  return (
    <div
      style={{
        visibility: showcaseFloatingVideosHidden ? "hidden" : "visible",
        pointerEvents: showcaseFloatingVideosHidden ? "none" : "auto"
      }}
    >
      {openIds.map((id) => {
        const m = hydrated[id];
        const rect = showcasePanelRect[id];
        if (!m || !rect) return null;
        const isVideo = VIDEO_EXT.test(m.file_url);
        const videoSrc = isVideo ? m.file_url : null;

        return (
          <FloatingPanel
            key={id}
            id={id}
            m={m}
            rect={rect}
            accentColor={cameraAccentColor(id)}
            videoSrc={videoSrc}
            isVideo={isVideo}
            bumpGlobalZ={bumpGlobalZ}
            onClose={() => {
              setShowcaseVideoOpen(id, false);
            }}
            clampAndSetRect={(r) => setShowcasePanelRect(id, clampPanel(r))}
          />
        );
      })}
    </div>
  );
}

function FloatingPanel(props: {
  id: string;
  m: UserMedia;
  rect: { left: number; top: number; width: number; height: number };
  accentColor: string;
  videoSrc: string | null;
  isVideo: boolean;
  bumpGlobalZ: () => number;
  onClose: () => void;
  clampAndSetRect: (r: { left: number; top: number; width: number; height: number }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const thumbUrl = mapPinThumbnailUrl(props.m.thumbnail_url);
  const label = props.m.username ?? `Cam ${props.id.slice(0, 6)}`;
  const capturedLabel = props.m.captured_at
    ? new Date(props.m.captured_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "";
  const infoTitle = [label, `${props.id.slice(0, 8)}…`, capturedLabel].filter(Boolean).join("\n");

  const hdrBtn: CSSProperties = {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 650,
    lineHeight: 1
  };
  const [stackZ, setStackZ] = useState(() => props.bumpGlobalZ());

  const bringFront = () => setStackZ(props.bumpGlobalZ());

  const [dimInactive, setDimInactive] = useState(false);
  const dimRef = useRef(false);
  const [frameReady, setFrameReady] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Pin spawn scales this layer — holds accent ring, chrome, and video so React opacity/z-index updates stay on the outer shell */
  const spawnAnimLayerRef = useRef<HTMLDivElement | null>(null);
  const spawnAnimStartedRef = useRef(false);
  /** Rect for spawn origin only — not in layout deps so drag/resize/clamp rerenders don’t cancel the scale-out RAF and stick at scale(0.14). */
  const spawnOriginRectRef = useRef(props.rect);
  spawnOriginRectRef.current = props.rect;
  const setSpawnAnchor = useApp((s) => s.setShowcasePanelSpawnAnchor);

  /** Whole card (accent ring + chrome + video); stable identity except when accent changes */
  const spawnFrameStyle = useMemo(
    (): CSSProperties => ({
      ...FLOAT_PANEL_FRAME_BASE_STYLE,
      background: props.accentColor
    }),
    [props.accentColor]
  );

  useLayoutEffect(() => {
    const anchor = useApp.getState().showcasePanelSpawnAnchor[props.id];
    if (!anchor || spawnAnimStartedRef.current) return;

    const el = spawnAnimLayerRef.current;
    if (!el) return;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSpawnAnchor(props.id, null);
      return;
    }

    spawnAnimStartedRef.current = true;

    const rect = spawnOriginRectRef.current;
    const ox = anchor.x - rect.left;
    const oy = anchor.y - rect.top;
    el.style.transformOrigin = `${ox}px ${oy}px`;
    el.style.transform = "scale(0.14)";
    el.style.transition = "none";

    let rafA = 0;
    let rafB = 0;
    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => {
        el.style.transition = "transform 0.48s cubic-bezier(0.22, 1, 0.32, 1)";
        el.style.transform = "scale(1)";
      });
    });

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      spawnAnimStartedRef.current = false;
      // Strict Mode or aborted run: never leave the panel stuck at scale(0.14).
      if (spawnAnimLayerRef.current === el) {
        el.style.transition = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
    };
  }, [props.id, setSpawnAnchor]);

  const onSpawnTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    const el = spawnAnimLayerRef.current;
    if (!useApp.getState().showcasePanelSpawnAnchor[props.id]) {
      if (el) {
        el.style.transition = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
      spawnAnimStartedRef.current = false;
      return;
    }
    setSpawnAnchor(props.id, null);
    spawnAnimStartedRef.current = false;
    if (el) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.transformOrigin = "";
    }
  };

  useEffect(() => {
    setFrameReady(false);
    const v = videoRef.current;
    if (!v || !props.isVideo || !props.videoSrc) return;

    const markReady = () => setFrameReady(true);
    v.addEventListener("loadeddata", markReady);
    v.addEventListener("canplay", markReady);
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) markReady();

    return () => {
      v.removeEventListener("loadeddata", markReady);
      v.removeEventListener("canplay", markReady);
    };
  }, [props.isVideo, props.videoSrc]);

  useEffect(() => {
    let raf = 0;
    const { m } = props;
    const tick = () => {
      const v = videoRef.current;
      const s = useApp.getState();

      let inRange = true;
      let offsetSecWall = 0;
      let offsetSec = 0;
      let spanSec = 0;

      if (props.isVideo) {
        const absoluteMs = s.liveStart + s.currentLivePlayhead();
        spanSec = clipDurationMs(m) / 1000;
        offsetSecWall = clipOffsetSecondsFromWall(m, absoluteMs);
        offsetSec =
          spanSec > 0
            ? Math.max(0, Math.min(offsetSecWall, spanSec))
            : Math.max(0, offsetSecWall);
        inRange = offsetSecWall >= 0 && offsetSecWall <= spanSec;

        const shouldDim = !inRange;
        if (dimRef.current !== shouldDim) {
          dimRef.current = shouldDim;
          setDimInactive(shouldDim);
        }
      } else if (dimRef.current) {
        dimRef.current = false;
        setDimInactive(false);
      }

      if (!v || !props.isVideo || !props.videoSrc) {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (s.showcaseFloatingVideosHidden) {
        if (!v.paused) v.pause();
        raf = requestAnimationFrame(tick);
        return;
      }

      const durVid = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : DEFAULT_CLIP_SECONDS;
      const drift = Math.abs(v.currentTime - Math.min(Math.max(offsetSec, 0), durVid));
      const canDecode = v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

      if (inRange && canDecode) {
        if ((!s.livePlaying && drift > 0.035) || drift > 0.85) {
          try {
            v.currentTime = Math.max(0, Math.min(offsetSecWall, durVid));
          } catch {
            /* */
          }
        }
        if (s.livePlaying) {
          if (v.playbackRate !== 1) v.playbackRate = 1;
          if (v.paused) void v.play().catch(() => {});
        } else if (!v.paused) {
          v.pause();
        }
      } else if (!v.paused) {
        v.pause();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [props.isVideo, props.videoSrc, props.m]);

  type DragS = {
    pid: number;
    startCX: number;
    startCY: number;
    oL: number;
    oT: number;
    w: number;
    h: number;
  };
  const dragRef = useRef<DragS | null>(null);
  type ResS = {
    pid: number;
    startCX: number;
    oW: number;
    oH: number;
    oL: number;
    oT: number;
    corner: ResizeCorner;
  };
  const resRef = useRef<ResS | null>(null);

  const onPanelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement | null;
    if (!el) return;
    if (el.closest("button")) return;
    if (el.closest("[data-float-resize]")) return;
    e.preventDefault();
    dragRef.current = {
      pid: e.pointerId,
      startCX: e.clientX,
      startCY: e.clientY,
      oL: props.rect.left,
      oT: props.rect.top,
      w: props.rect.width,
      h: props.rect.height
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPanelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sess = dragRef.current;
    if (!sess || e.pointerId !== sess.pid || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - sess.startCX;
    const dy = e.clientY - sess.startCY;
    props.clampAndSetRect({ left: sess.oL + dx, top: sess.oT + dy, width: sess.w, height: sess.h });
  };

  const onPanelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && e.pointerId === dragRef.current.pid) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, corner: ResizeCorner) => {
    e.preventDefault();
    e.stopPropagation();
    resRef.current = {
      pid: e.pointerId,
      startCX: e.clientX,
      oW: props.rect.width,
      oH: props.rect.height,
      oL: props.rect.left,
      oT: props.rect.top,
      corner
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const sess = resRef.current;
    if (!sess || e.pointerId !== sess.pid || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - sess.startCX;
    const bottomY = sess.oT + sess.oH;
    const rightX = sess.oL + sess.oW;

    let candW: number;
    let candL = sess.oL;
    let candT = sess.oT;

    switch (sess.corner) {
      case "se":
        candW = clampFloatPanelWidth(sess.oW + dx);
        candL = sess.oL;
        candT = sess.oT;
        break;
      case "sw":
        candW = clampFloatPanelWidth(sess.oW - dx);
        candL = rightX - candW;
        candT = sess.oT;
        break;
      case "ne":
        candW = clampFloatPanelWidth(sess.oW + dx);
        candL = sess.oL;
        candT = bottomY - showcasePanelOuterHeight(candW);
        break;
      case "nw":
        candW = clampFloatPanelWidth(sess.oW - dx);
        candL = rightX - candW;
        candT = bottomY - showcasePanelOuterHeight(candW);
        break;
      default:
        return;
    }

    props.clampAndSetRect({
      left: candL,
      top: candT,
      width: candW,
      height: showcasePanelOuterHeight(candW)
    });
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (resRef.current && e.pointerId === resRef.current.pid) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      resRef.current = null;
    }
  };

  return (
    <div
      ref={panelRef}
      onPointerDownCapture={() => {
        bringFront();
      }}
      onPointerDown={onPanelPointerDown}
      onPointerMove={onPanelPointerMove}
      onPointerUp={onPanelPointerUp}
      onPointerCancel={onPanelPointerUp}
      style={{
        position: "absolute",
        left: props.rect.left,
        top: props.rect.top,
        width: props.rect.width,
        height: props.rect.height,
        zIndex: stackZ,
        touchAction: "none",
        cursor: "grab",
        userSelect: "none",
        opacity: dimInactive ? 0.5 : 1,
        transition: "opacity 0.22s ease"
      }}
      role="dialog"
      aria-label={`Eyewitness clip ${props.id.slice(0, 8)}`}
    >
      <div ref={spawnAnimLayerRef} style={spawnFrameStyle} onTransitionEnd={onSpawnTransitionEnd}>
      <div
        style={{
          flexShrink: 0,
          width: "100%",
          aspectRatio: "9 / 16",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 12,
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: "4px 6px",
            borderRadius: 10,
            background: "rgba(8,8,10,0.42)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxSizing: "border-box",
            pointerEvents: "auto"
          }}
        >
          <button
            type="button"
            aria-label="Clip details"
            title={infoTitle}
            style={{
              ...hdrBtn,
              fontSize: 11,
              fontStyle: "italic",
              fontFamily: 'Georgia, "Times New Roman", serif'
            }}
          >
            i
          </button>
          <button
            type="button"
            aria-label="Close video"
            title="Close"
            onClick={(ev) => {
              ev.stopPropagation();
              props.onClose();
            }}
            style={{ ...hdrBtn, fontSize: 13 }}
          >
            ×
          </button>
        </div>
        {!props.isVideo || !props.videoSrc ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-dim)",
              fontSize: 12,
              backgroundImage: thumbUrl
                ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url(${thumbUrl})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          >
            {props.isVideo ? (!props.videoSrc ? "Caching…" : "") : "Photo"}
          </div>
        ) : (
          <>
            {thumbUrl && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.45)), url(${thumbUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: frameReady ? 0 : 1,
                  transition: "opacity 0.15s ease",
                  pointerEvents: "none"
                }}
              />
            )}
            <video
              ref={videoRef}
              src={props.videoSrc}
              muted
              playsInline
              preload="auto"
              poster={thumbUrl || undefined}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                opacity: frameReady ? 1 : 0,
                transition: "opacity 0.15s ease"
              }}
            />
          </>
        )}

        {( ["nw", "ne", "sw", "se"] as const).map((corner) => (
          <div
            key={corner}
            role="presentation"
            aria-hidden
            data-float-resize=""
            onPointerDown={(ev) => onResizePointerDown(ev, corner)}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            style={{
              position: "absolute",
              width: FLOAT_CORNER_HIT_PX,
              height: FLOAT_CORNER_HIT_PX,
              zIndex: 8,
              touchAction: "none",
              cursor: resizeCornerCursor(corner),
              display: "flex",
              ...FLOAT_CORNER_GRIP_FLEX[corner]
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              aria-hidden
              style={{ opacity: 0.48 }}
            >
              <path
                d={FLOAT_CORNER_GRIP_PATH[corner]}
                fill="none"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
