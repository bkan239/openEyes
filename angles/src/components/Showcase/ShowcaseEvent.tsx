import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map/MapView";
import { Timeline } from "@/components/LiveMode/Timeline";
import { ShowcaseFloatingVideos } from "@/components/Showcase/ShowcaseFloatingVideos";
import { useApp } from "@/state/store";
import {
  loadPrettiMedia,
  prettiStory,
  PRETTI_CENTER,
  PRETTI_STORY_ID,
  prettiItemsBounds
} from "@/lib/demo";
import { endOfDay } from "@/lib/time";
import { preloadClipsSequential } from "@/lib/videoPreload";

/** Opening establishing shot — urban context (was continental ~11). */
const INTRO_WIDE_ZOOM = 15.6;
const INTRO_WIDE_MS = 1700;
const INTRO_DETAIL_MS = 3200;
/** Incident framing — tight enough that metric scale ticks ≈ single-digit meters on laptop */
const INTRO_DETAIL_ZOOM = 19.35;
const RECENTER_MS = 2400;

function flyToIncidentDetail() {
  const { flyTo } = useApp.getState();
  const items = useApp.getState().prettiOverlayItems;
  const bb = prettiItemsBounds(items);
  if (bb) {
    const [w, s, e, n] = bb;
    flyTo({
      center: PRETTI_CENTER,
      zoom: INTRO_DETAIL_ZOOM,
      bounds: [w, s, e, n],
      duration: RECENTER_MS
    });
  } else {
    flyTo({ center: PRETTI_CENTER, zoom: INTRO_DETAIL_ZOOM, duration: RECENTER_MS });
  }
}

export function ShowcaseEvent() {
  const recenterGradId = `pretti-recenter-grad-${useId().replace(/:/g, "")}`;

  const setUiMode = useApp((s) => s.setUiMode);
  const setShowcaseMapReady = useApp((s) => s.setShowcaseMapReady);
  const showcaseMapReady = useApp((s) => s.showcaseMapReady);
  const showcaseIntroLocked = useApp((s) => s.showcaseIntroLocked);
  const setShowcaseIntroLocked = useApp((s) => s.setShowcaseIntroLocked);
  const resetShowcaseUi = useApp((s) => s.resetShowcaseUi);
  const flyTo = useApp((s) => s.flyTo);
  const setLiveMode = useApp((s) => s.setLiveMode);
  const setLivePlaying = useApp((s) => s.setLivePlaying);
  const setSelectedStoryId = useApp((s) => s.setSelectedStoryId);
  const setStoryMedia = useApp((s) => s.setStoryMedia);
  const setRange = useApp((s) => s.setRange);
  const setPrettiOverlayItems = useApp((s) => s.setPrettiOverlayItems);
  const setMediaItems = useApp((s) => s.setMediaItems);
  const liveMode = useApp((s) => s.liveMode);
  const showcaseFloatingVideosHidden = useApp((s) => s.showcaseFloatingVideosHidden);
  const toggleShowcaseFloatingVideosHidden = useApp((s) => s.toggleShowcaseFloatingVideosHidden);

  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  const surfaceReady = mediaLoaded && (showcaseMapReady || splashTimedOut);

  const introTimers = useRef<number[]>([]);

  useLayoutEffect(() => {
    setUiMode("showcase");
    setShowcaseMapReady(false);
    setSplashTimedOut(false);
    setMediaItems([]);
    setShowcaseIntroLocked(true);
  }, [setMediaItems, setShowcaseIntroLocked, setShowcaseMapReady, setUiMode]);

  useEffect(() => {
    if (!mediaLoaded) return;
    const t = window.setTimeout(() => setSplashTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, [mediaLoaded]);

  useEffect(() => {
    return () => {
      introTimers.current.forEach(clearTimeout);
      introTimers.current = [];
      resetShowcaseUi();
      setShowcaseMapReady(false);
      setLiveMode(false);
      setLivePlaying(false);
    };
  }, [resetShowcaseUi, setLiveMode, setLivePlaying, setShowcaseMapReady]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const items = await loadPrettiMedia();
        if (cancelled) return;
        setPrettiOverlayItems(items);
        setStoryMedia(PRETTI_STORY_ID, items);
        setSelectedStoryId(PRETTI_STORY_ID);
        const eventTime = new Date(prettiStory.event_time!);
        const from = new Date(eventTime);
        from.setDate(from.getDate() - 1);
        const to = endOfDay(new Date(eventTime.getTime() + 24 * 3600 * 1000));
        setRange(from, to);
      } finally {
        if (!cancelled) setMediaLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setPrettiOverlayItems, setRange, setSelectedStoryId, setStoryMedia]);

  /** Warm all clips sequentially (timeline order) once the demo surface is up — cache before pin clicks. */
  useEffect(() => {
    if (!surfaceReady) return;
    const items = useApp.getState().prettiOverlayItems;
    if (!items.length) return;
    return preloadClipsSequential(items);
  }, [surfaceReady]);

  useEffect(() => {
    if (!surfaceReady) return;
    introTimers.current.forEach(clearTimeout);
    introTimers.current = [];

    flyTo({
      center: PRETTI_CENTER,
      zoom: INTRO_WIDE_ZOOM,
      duration: INTRO_WIDE_MS
    });

    const items = useApp.getState().prettiOverlayItems;
    const tDetail = window.setTimeout(() => {
      const bb = prettiItemsBounds(items);
      if (bb) {
        const [w, s, e, n] = bb;
        flyTo({
          center: PRETTI_CENTER,
          zoom: INTRO_DETAIL_ZOOM,
          bounds: [w, s, e, n],
          duration: INTRO_DETAIL_MS
        });
      } else {
        flyTo({ center: PRETTI_CENTER, zoom: INTRO_DETAIL_ZOOM, duration: INTRO_DETAIL_MS });
      }
    }, INTRO_WIDE_MS + 280);

    const tLive = window.setTimeout(() => {
      setLiveMode(true);
      setLivePlaying(false);
      setShowcaseIntroLocked(false);
    }, INTRO_WIDE_MS + INTRO_DETAIL_MS + 620);

    introTimers.current.push(tDetail, tLive);

    return () => {
      window.clearTimeout(tDetail);
      window.clearTimeout(tLive);
      introTimers.current = [];
    };
  }, [flyTo, setLiveMode, setLivePlaying, setShowcaseIntroLocked, surfaceReady]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: "#000" }}>
      <header
        style={{
          flexShrink: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid var(--hairline)",
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)"
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.35, color: "var(--text-faint)", textTransform: "uppercase" }}>
            Event showcase · Minneapolis
          </div>
          <div style={{ fontSize: 14, fontWeight: 650, color: "var(--text)", lineHeight: 1.3, marginTop: 3 }}>
            {prettiStory.title}
          </div>
        </div>
      </header>

      <main
        className={`showcase-demo-hud${showcaseIntroLocked ? " showcase-intro-locked" : ""}`}
        style={{ flex: 1, position: "relative", minHeight: 0 }}
      >
        <MapView />

        {!surfaceReady && (
          <div
            role="progressbar"
            aria-busy="true"
            aria-valuetext={!mediaLoaded ? "Loading media" : "Preparing map"}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 22,
              background:
                "radial-gradient(ellipse 120% 80% at 50% 42%, rgba(18,32,54,0.94) 0%, rgba(4,8,14,0.97) 55%, rgba(0,0,0,0.99) 100%)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)"
            }}
          >
            <div
              className="showcase-loader-glow showcase-loader-pulse"
              style={{
                width: 92,
                height: 92,
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(135deg, rgba(125,211,252,0.16) 0%, rgba(167,139,250,0.12) 50%, rgba(12,24,42,0.5) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box"
              }}
            >
              <div
                className="showcase-spinner"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "rgba(125,211,252,0.95)",
                  borderRightColor: "rgba(167,139,250,0.75)"
                }}
              />
            </div>
            <div style={{ textAlign: "center", maxWidth: 340, padding: "0 20px" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 650,
                  letterSpacing: 0.02,
                  color: "rgba(255,255,255,0.94)",
                  textShadow: "0 2px 24px rgba(0,0,0,0.5)"
                }}
              >
                Preparing showcase
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.52)",
                  fontWeight: 500
                }}
              >
                {!mediaLoaded
                  ? "Loading verified eyewitness clips and metadata…"
                  : "Finishing map tiles and incident layers…"}
              </div>
            </div>
          </div>
        )}

        {surfaceReady && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 95,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10
            }}
          >
            <svg width="0" height="0" style={{ position: "absolute", overflow: "hidden" }} aria-hidden>
              <defs>
                <linearGradient id={recenterGradId} x1="4" y1="4" x2="20" y2="20">
                  <stop stopColor="#7dd3fc" />
                  <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
            </svg>
            <button
              type="button"
              aria-label="Center map on incident"
              aria-disabled={showcaseIntroLocked}
              disabled={showcaseIntroLocked}
              title={
                showcaseIntroLocked
                  ? "Available after the opening view finishes"
                  : "Fly back to 26th & Nicollet"
              }
              onClick={() => flyToIncidentDetail()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 16px 10px 13px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "linear-gradient(145deg, rgba(28,28,32,0.82) 0%, rgba(14,14,18,0.88) 100%)",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow:
                  "0 0 0 1px rgba(0,0,0,0.45) inset, 0 8px 28px rgba(0,0,0,0.45), 0 0 24px rgba(99, 180, 255, 0.12)",
                color: "rgba(255,255,255,0.95)",
                fontSize: 12,
                fontWeight: 650,
                letterSpacing: 0.03,
                cursor: showcaseIntroLocked ? "not-allowed" : "pointer",
                opacity: showcaseIntroLocked ? 0.42 : 1,
                transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, opacity 160ms ease"
              }}
              onMouseEnter={(e) => {
                if (showcaseIntroLocked) return;
                e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 1px rgba(0,0,0,0.5) inset, 0 12px 36px rgba(0,0,0,0.5), 0 0 28px rgba(130, 196, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                if (showcaseIntroLocked) return;
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 1px rgba(0,0,0,0.45) inset, 0 8px 28px rgba(0,0,0,0.45), 0 0 24px rgba(99, 180, 255, 0.12)";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0, opacity: 0.92 }}>
                <path
                  d="M12 4v4M12 16v4M4 12h4M16 12h4"
                  stroke={`url(#${recenterGradId})`}
                  strokeWidth="1.45"
                  strokeLinecap="round"
                />
                <path
                  d="M7 7L4 4M17 7L20 4M7 17L4 20M17 17L20 20"
                  stroke={`url(#${recenterGradId})`}
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="3" stroke={`url(#${recenterGradId})`} strokeWidth="1.35" />
              </svg>
              <span style={{ textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>Center again</span>
            </button>

            {liveMode && (
              <button
                type="button"
                aria-label={showcaseFloatingVideosHidden ? "Show floating clips" : "Hide floating clips"}
                aria-pressed={showcaseFloatingVideosHidden}
                title={showcaseFloatingVideosHidden ? "Show eyewitness clips" : "Hide eyewitness clips"}
                onClick={() => toggleShowcaseFloatingVideosHidden()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  border: showcaseFloatingVideosHidden
                    ? "1px solid rgba(125,211,252,0.35)"
                    : "1px solid rgba(255,255,255,0.14)",
                  background: showcaseFloatingVideosHidden
                    ? "linear-gradient(145deg, rgba(36,52,72,0.9) 0%, rgba(22,26,38,0.92) 100%)"
                    : "linear-gradient(145deg, rgba(28,28,32,0.82) 0%, rgba(14,14,18,0.88) 100%)",
                  backdropFilter: "blur(20px) saturate(180%)",
                  WebkitBackdropFilter: "blur(20px) saturate(180%)",
                  boxShadow: showcaseFloatingVideosHidden
                    ? "0 0 0 1px rgba(0,0,0,0.45) inset, 0 6px 22px rgba(0,0,0,0.42), 0 0 20px rgba(99, 180, 255, 0.18)"
                    : "0 0 0 1px rgba(0,0,0,0.45) inset, 0 8px 28px rgba(0,0,0,0.45), 0 0 24px rgba(99, 180, 255, 0.12)",
                  cursor: "pointer",
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px) scale(1.04)";
                  if (!showcaseFloatingVideosHidden) {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 1px rgba(0,0,0,0.5) inset, 0 12px 36px rgba(0,0,0,0.5), 0 0 28px rgba(130, 196, 255, 0.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  if (!showcaseFloatingVideosHidden) {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                    e.currentTarget.style.boxShadow =
                      "0 0 0 1px rgba(0,0,0,0.45) inset, 0 8px 28px rgba(0,0,0,0.45), 0 0 24px rgba(99, 180, 255, 0.12)";
                  }
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden style={{ opacity: 0.94 }}>
                  {showcaseFloatingVideosHidden ? (
                    <>
                      <path
                        d="M3 3l18 18M10.73 10.73a3 3 0 004.54 4.54M9.88 9.88A9.94 9.94 0 0112 5c4 0 7.33 3.33 10 10a17.53 17.53 0 01-2.57 4.59"
                        stroke={`url(#${recenterGradId})`}
                        strokeWidth="1.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M6.61 6.61C4.63 8.02 3 10 2 12c3 7 10 11 10 11 .94-.52 2.04-1.23 3.17-2.06"
                        stroke={`url(#${recenterGradId})`}
                        strokeWidth="1.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.12 14.12c-.52.37-1.15.62-1.87.62a3 3 0 01-3-3c0-.72.24-1.35.61-1.87"
                        stroke={`url(#${recenterGradId})`}
                        strokeWidth="1.45"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      <path
                        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                        stroke={`url(#${recenterGradId})`}
                        strokeWidth="1.45"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" stroke={`url(#${recenterGradId})`} strokeWidth="1.45" />
                    </>
                  )}
                </svg>
              </button>
            )}
          </div>
        )}

        {liveMode && (
          <>
            <Timeline stackZ={96} hideLiveBadge hideClipLabels minimalTransport />
            <ShowcaseFloatingVideos />
          </>
        )}
      </main>
    </div>
  );
}
