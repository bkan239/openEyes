import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { fmtClock, fmtTime } from "@/lib/time";
import type { UserMedia } from "@/lib/types";
import { cameraAccentColor } from "@/lib/cameraColors";
import { isMockExcludedMediaId } from "@/lib/demo";
import { DEFAULT_CLIP_MS } from "@/lib/livePlayback";
/** Label column + gap; rails and scrubber share the same horizontal scale. */
const RAIL_INSET_PX = 60;

function clipSegmentOnTimeline(
  m: UserMedia,
  liveStart: number,
  liveEnd: number
): { leftPct: number; widthPct: number } | null {
  const windowMs = Math.max(1, liveEnd - liveStart);
  const t0 = new Date(m.captured_at).getTime();
  const spanMs = m.samples?.length ? m.samples[m.samples.length - 1].t_ms : DEFAULT_CLIP_MS;
  const t1 = t0 + spanMs;
  const rel0 = t0 - liveStart;
  const rel1 = t1 - liveStart;
  const s = Math.max(0, rel0);
  const e = Math.min(windowMs, rel1);
  if (e <= s) return null;
  return { leftPct: (s / windowMs) * 100, widthPct: ((e - s) / windowMs) * 100 };
}

export function Timeline({
  stackZ = 20,
  hideLiveBadge = false,
  hideClipLabels = false,
  minimalTransport = false
}: {
  stackZ?: number;
  hideLiveBadge?: boolean;
  hideClipLabels?: boolean;
  minimalTransport?: boolean;
}) {
  const liveStart = useApp((s) => s.liveStart);
  const liveEnd = useApp((s) => s.liveEnd);
  const livePlaying = useApp((s) => s.livePlaying);
  const livePlayhead = useApp((s) => s.livePlayhead);
  const setLivePlayhead = useApp((s) => s.setLivePlayhead);
  const setLivePlaying = useApp((s) => s.setLivePlaying);
  const selectedCameraIds = useApp((s) => s.selectedCameraIds);
  const prettiOverlayItems = useApp((s) => s.prettiOverlayItems);
  const total = Math.max(1, liveEnd - liveStart);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastUiTickRef = useRef<number>(0);
  const [displayPlayhead, setDisplayPlayhead] = useState(livePlayhead);

  // UI-only timeline animation. The real playback clock is derived imperatively
  // from performance.now(), so this does not drive video/map sync through React.
  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const next = useApp.getState().currentLivePlayhead();
      if (livePlaying && next >= total) {
        setLivePlayhead(total);
        setLivePlaying(false);
        return;
      }
      if (now - lastUiTickRef.current > 66) {
        lastUiTickRef.current = now;
        setDisplayPlayhead(next);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [livePlaying, total, setLivePlayhead, setLivePlaying]);

  useEffect(() => {
    setDisplayPlayhead(useApp.getState().currentLivePlayhead());
  }, [livePlayhead, liveStart, liveEnd]);

  function onSeek(e: React.MouseEvent | React.PointerEvent) {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = "clientX" in e ? e.clientX : 0;
    const u = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    const next = u * total;
    setDisplayPlayhead(next);
    setLivePlayhead(next);
  }

  const pct = (displayPlayhead / total) * 100;
  const railInsetPx = hideClipLabels ? 0 : RAIL_INSET_PX;
  const startWall = new Date(liveStart);
  const endWall = new Date(liveEnd);

  const clipRows = useMemo(() => {
    const rows: Array<{ id: string; color: string; segment: { leftPct: number; widthPct: number } | null }> = [];
    for (const id of selectedCameraIds) {
      if (isMockExcludedMediaId(id)) continue;
      const m = prettiOverlayItems.find((x) => x.id === id);
      if (!m) continue;
      rows.push({
        id,
        color: cameraAccentColor(id),
        segment: clipSegmentOnTimeline(m, liveStart, liveEnd)
      });
    }
    return rows;
  }, [selectedCameraIds, prettiOverlayItems, liveStart, liveEnd]);

  const clipMeasureRef = useRef<HTMLDivElement>(null);
  const [leadAboveScrubberPx, setLeadAboveScrubberPx] = useState(0);

  useLayoutEffect(() => {
    const el = clipMeasureRef.current;
    if (!el) {
      setLeadAboveScrubberPx(0);
      return;
    }
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const mb = parseFloat(getComputedStyle(el).marginBottom) || 0;
      setLeadAboveScrubberPx(rect.height + mb);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clipRows, hideClipLabels]);

  const scrubberTrack = (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onSeek(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons) onSeek(e);
      }}
      style={{
        position: "relative",
        height: 6,
        borderRadius: 3,
        background: "rgba(255,255,255,0.10)",
        cursor: "pointer",
        zIndex: 1
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct}%`,
          background: "var(--accent)",
          borderRadius: 3
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          width: 14,
          height: 14,
          borderRadius: 7,
          background: "var(--accent)",
          boxShadow: "0 0 0 4px rgba(255,255,255,0.18)",
          zIndex: 4
        }}
      />
    </div>
  );

  const scrubPlayheadRail = (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${pct}%`,
        transform: "translateX(-50%)",
        top: -leadAboveScrubberPx,
        bottom: 0,
        width: 2,
        background:
          "linear-gradient(to bottom, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.82) 35%, rgba(255,255,255,0.82))",
        borderRadius: 1,
        pointerEvents: "none",
        zIndex: 2,
        boxShadow: "0 0 12px rgba(255,255,255,0.2)"
      }}
    />
  );

  const minimalTransportPlayBtn = (
    <button
      type="button"
      aria-label={livePlaying ? "Pause" : "Play"}
      title={livePlaying ? "Pause" : "Play"}
      onClick={() => setLivePlaying(!livePlaying)}
      style={{
        flexShrink: 0,
        padding: "2px 8px 2px 2px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.82)",
        cursor: "pointer",
        outline: "none",
        transition: "color 160ms ease, transform 160ms ease"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.98)";
        e.currentTarget.style.transform = "scale(1.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.82)";
        e.currentTarget.style.transform = "none";
      }}
      onFocus={(e) => {
        e.currentTarget.style.filter = "drop-shadow(0 0 5px rgba(125,211,252,0.5))";
      }}
      onBlur={(e) => {
        e.currentTarget.style.filter = "";
      }}
    >
      {livePlaying ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5.25v13.5L18.25 12 8 5.25z" />
        </svg>
      )}
    </button>
  );

  /** Clip rails + scrub share one column width so %-positions match (minimal transport play sits beside this column). */
  const tracksColumn = (
    <>
      <div ref={clipMeasureRef} style={{ marginBottom: clipRows.length > 0 ? 8 : 0 }}>
        {clipRows.length > 0 && (
          <div style={{ paddingBottom: 6 }}>
            {clipRows.map(({ id, color, segment }) => (
              <div
                key={id}
                style={{ marginBottom: 4, position: "relative" }}
                title={`${id.slice(0, 8)}… · clip on timeline`}
              >
                {!hideClipLabels && (
                  <span
                    style={{
                      position: "absolute",
                      left: -RAIL_INSET_PX,
                      width: 52,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 9,
                      fontWeight: 600,
                      color,
                      letterSpacing: 0.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {id.slice(0, 6)}
                  </span>
                )}
                <div
                  style={{
                    height: 5,
                    position: "relative",
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.06)"
                  }}
                >
                  {segment && segment.widthPct > 0 && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: `${segment.leftPct}%`,
                          width: `${segment.widthPct}%`,
                          top: 0,
                          bottom: 0,
                          background: color,
                          borderRadius: 2,
                          opacity: 0.92,
                          boxShadow: `0 0 10px ${color}44`
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `${segment.leftPct}%`,
                          top: -2,
                          bottom: -2,
                          width: 1,
                          background: color,
                          opacity: 0.65,
                          pointerEvents: "none"
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: `calc(${segment.leftPct}% + ${segment.widthPct}% - 1px)`,
                          top: -2,
                          bottom: -2,
                          width: 1,
                          background: color,
                          opacity: 0.65,
                          pointerEvents: "none"
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: "relative", width: "100%" }}>
        {scrubPlayheadRail}
        {scrubberTrack}
      </div>
    </>
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(900px, calc(100% - 460px))",
        zIndex: stackZ,
        padding: 16,
        borderRadius: 18,
        background: "rgba(0,0,0,0.78)",
        border: "1px solid var(--glass-stroke)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: minimalTransport ? "flex-start" : "center",
          gap: 12
        }}
      >
        {!minimalTransport && (
          <button
            type="button"
            className="btn primary"
            aria-label={livePlaying ? "Pause" : "Play"}
            title={livePlaying ? "Pause" : "Play"}
            onClick={() => setLivePlaying(!livePlaying)}
            style={{ minWidth: 96, padding: "10px 14px" }}
          >
            {livePlaying ? "❚❚ Pause" : "▶  Play"}
          </button>
        )}

        {minimalTransport ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              columnGap: 10,
              rowGap: 8,
              alignItems: "start",
              minWidth: 0
            }}
          >
            {/* Column 1 width follows the play button; keeps clock labels aligned with %-tracks */}
            <span aria-hidden style={{ gridColumn: 1, gridRow: 1 }} />
            <div
              style={{
                gridColumn: 2,
                gridRow: 1,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: "var(--text-faint)",
                minWidth: 0
              }}
            >
              <span>{fmtTime(startWall)}</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtClock(displayPlayhead)}</span>
              <span>{fmtTime(endWall)}</span>
            </div>
            <div style={{ gridColumn: 1, gridRow: 2 }}>{minimalTransportPlayBtn}</div>
            <div style={{ gridColumn: 2, gridRow: 2, position: "relative", paddingLeft: railInsetPx, minWidth: 0 }}>
              {tracksColumn}
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)" }}>
              <span>{fmtTime(startWall)}</span>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{fmtClock(displayPlayhead)}</span>
              <span>{fmtTime(endWall)}</span>
            </div>

            <div style={{ position: "relative", paddingLeft: railInsetPx }}>{tracksColumn}</div>
          </div>
        )}

        {!hideLiveBadge && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--text-faint)", textTransform: "uppercase" }}>
              Live
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
