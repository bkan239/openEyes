import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapView } from "@/components/Map/MapView";
import { Timeline } from "@/components/LiveMode/Timeline";
import { ShowcaseFloatingVideos } from "@/components/Showcase/ShowcaseFloatingVideos";
import { AnglesPanel } from "@/components/Showcase/AnglesPanel";
import { useApp } from "@/state/store";
import { useLivePerspectives } from "@/state/useLivePerspectives";
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
/** Open paused on the moment of peak corroboration (4 of 5 angles live, J still to come). */
const SHOWCASE_OPENING_PLAYHEAD_MS = 48_000;

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

function CenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
      <path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function ShowcaseEvent() {
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
  const liveStart = useApp((s) => s.liveStart);
  const liveEnd = useApp((s) => s.liveEnd);
  const setLivePlayhead = useApp((s) => s.setLivePlayhead);

  const { perspectives, total, liveCount, trust } = useLivePerspectives();

  // Once live bounds exist, jump (once) to the peak-corroboration opening frame.
  const seededPlayheadRef = useRef(false);
  useEffect(() => {
    if (!liveMode) {
      seededPlayheadRef.current = false;
      return;
    }
    if (seededPlayheadRef.current || liveEnd - liveStart <= 0) return;
    seededPlayheadRef.current = true;
    setLivePlayhead(Math.min(SHOWCASE_OPENING_PLAYHEAD_MS, liveEnd - liveStart));
  }, [liveMode, liveStart, liveEnd, setLivePlayhead]);

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
    <div
      className={`showcase-demo-hud${showcaseIntroLocked ? " showcase-intro-locked" : ""}`}
      style={{ position: "relative", height: "100vh", width: "100vw", background: "var(--map-void)", overflow: "hidden" }}
    >
      <MapView />
      <div className="ev-map-tint" aria-hidden />

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
              "radial-gradient(ellipse 120% 80% at 50% 42%, rgba(38,36,31,0.96) 0%, rgba(22,19,16,0.98) 55%, rgba(22,19,16,1) 100%)",
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
              border: "2px solid rgba(252,251,248,0.12)",
              background:
                "linear-gradient(135deg, rgba(111,189,176,0.18) 0%, rgba(47,143,131,0.12) 50%, rgba(22,19,16,0.5) 100%)",
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
                border: "2px solid rgba(252,251,248,0.3)",
                borderTopColor: "rgba(111,189,176,0.95)",
                borderRightColor: "rgba(47,143,131,0.8)"
              }}
            />
          </div>
          <div style={{ textAlign: "center", maxWidth: 340, padding: "0 20px" }}>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 19,
                fontWeight: 500,
                letterSpacing: 0.01,
                color: "var(--ink)"
              }}
            >
              Preparing the reconstruction
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--ink-dim)",
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
        <div className="ev-topbar">
          <div className="ev-eyebrow">
            OpenEyes<span className="sep" />Verified Event<span className="dim">· MPLS-0419</span>
          </div>
          <h1 className="ev-headline">
            The killing of Alex&nbsp;Pretti, <em>corroborated</em>.
          </h1>
          <div className="ev-dateline">
            <span>MINNEAPOLIS · NICOLLET AVE</span>
            <span className="dot" />
            <span>09:00 CDT</span>
            <span className="dot" />
            <span>
              {liveCount} of {total} angles live
            </span>
          </div>
          <div className="ev-trust">
            <div className="ev-trust-num">{trust.toFixed(2)}</div>
            <div className="ev-trust-meta">
              <div className="ev-trust-label">Trust index · corroboration</div>
              <div className="ev-trust-bars">
                {perspectives.map((p) => (
                  <i key={p.id} className={p.status === "live" ? "" : "off"} />
                ))}
              </div>
              <div className="ev-trust-sub">
                {liveCount} independent sources · audio-synced · no tampering
              </div>
            </div>
          </div>
        </div>
      )}

      {surfaceReady && (
        <button
          type="button"
          className="ev-pill"
          aria-label="Center map on incident"
          disabled={showcaseIntroLocked}
          title={showcaseIntroLocked ? "Available after the opening view finishes" : "Fly back to 26th & Nicollet"}
          onClick={() => flyToIncidentDetail()}
          style={{ position: "absolute", top: 22, right: 26, zIndex: 95 }}
        >
          <CenterIcon />
          Center again
        </button>
      )}

      {liveMode && (
        <>
          <AnglesPanel perspectives={perspectives} total={total} liveCount={liveCount} />
          <Timeline stackZ={96} editorial perspectives={perspectives} />
          <ShowcaseFloatingVideos />
        </>
      )}
    </div>
  );
}
