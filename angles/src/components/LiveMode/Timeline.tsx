import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { fmtClock, fmtTime } from "@/lib/time";
import type { UserMedia } from "@/lib/types";
import { DEFAULT_CLIP_MS } from "@/lib/livePlayback";
import type { LivePerspective } from "@/state/useLivePerspectives";

function clipSegmentOnTimeline(
  m: UserMedia,
  liveStart: number,
  liveEnd: number
): { leftPct: number; widthPct: number } | null {
  const windowMs = Math.max(1, liveEnd - liveStart);
  const t0 = new Date(m.captured_at).getTime();
  const spanMs = m.samples?.length ? m.samples[m.samples.length - 1].t_ms : DEFAULT_CLIP_MS;
  const t1 = t0 + spanMs;
  const s = Math.max(0, t0 - liveStart);
  const e = Math.min(windowMs, t1 - liveStart);
  if (e <= s) return null;
  return { leftPct: (s / windowMs) * 100, widthPct: ((e - s) / windowMs) * 100 };
}

/**
 * Editorial synced timeline: a play control, the per-perspective initials, a
 * lane per angle (when its footage runs) and a scrubber + playhead. Colours
 * and ordering come from the shared perspectives model so it matches the panel.
 */
export function Timeline({
  stackZ = 96,
  perspectives = []
}: {
  stackZ?: number;
  /** `editorial` kept for call-site clarity; the showcase timeline is the only mode. */
  editorial?: boolean;
  perspectives?: LivePerspective[];
}) {
  const liveStart = useApp((s) => s.liveStart);
  const liveEnd = useApp((s) => s.liveEnd);
  const livePlaying = useApp((s) => s.livePlaying);
  const livePlayhead = useApp((s) => s.livePlayhead);
  const setLivePlayhead = useApp((s) => s.setLivePlayhead);
  const setLivePlaying = useApp((s) => s.setLivePlaying);

  const total = Math.max(1, liveEnd - liveStart);
  const scrubRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const lastUiTickRef = useRef<number>(0);
  const [displayPlayhead, setDisplayPlayhead] = useState(livePlayhead);

  // UI-only animation; the real clock is derived imperatively from performance.now().
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

  function onSeek(clientX: number) {
    const el = scrubRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = u * total;
    setDisplayPlayhead(next);
    setLivePlayhead(next);
  }

  const pct = (displayPlayhead / total) * 100;
  const startWall = new Date(liveStart);
  const endWall = new Date(liveEnd);

  const lanes = useMemo(
    () =>
      perspectives.map((p) => ({
        id: p.id,
        color: p.identity.color,
        live: p.status === "live",
        segment: clipSegmentOnTimeline(p.media, liveStart, liveEnd)
      })),
    [perspectives, liveStart, liveEnd]
  );

  return (
    <div className="ev-timeline" style={{ zIndex: stackZ }}>
      <div className="ev-tl-head">
        <span className="ev-tl-end">{fmtTime(startWall)}</span>
        <span className="ev-tl-now">{fmtClock(displayPlayhead)}</span>
        <span className="ev-tl-end">{fmtTime(endWall)}</span>
      </div>

      <div className="ev-tl-body">
        <button
          type="button"
          className="ev-tl-play"
          aria-label={livePlaying ? "Pause" : "Play"}
          title={livePlaying ? "Pause" : "Play"}
          onClick={() => setLivePlaying(!livePlaying)}
        >
          {livePlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="4.5" width="4.2" height="15" rx="1" />
              <rect x="13.8" y="4.5" width="4.2" height="15" rx="1" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          )}
        </button>

        <div className="ev-tl-letters" aria-hidden>
          {perspectives.map((p) => (
            <span key={p.id} style={{ color: p.identity.color, opacity: p.status === "live" ? 1 : 0.5 }}>
              {p.identity.initial}
            </span>
          ))}
        </div>

        <div className="ev-tl-lanes">
          {lanes.map((lane) => (
            <div className="ev-lane" key={lane.id}>
              {lane.segment && lane.segment.widthPct > 0 && (
                <div
                  className="ev-lane-fill"
                  style={{
                    left: `${lane.segment.leftPct}%`,
                    width: `${lane.segment.widthPct}%`,
                    background: lane.color,
                    opacity: lane.live ? 0.95 : 0.5
                  }}
                />
              )}
            </div>
          ))}

          <div
            className="ev-tl-scrub"
            ref={scrubRef}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              setLivePlaying(false);
              onSeek(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons) onSeek(e.clientX);
            }}
          >
            <div className="ev-tl-track" />
            <div className="ev-tl-track-done" style={{ width: `${pct}%` }} />
          </div>

          <div className="ev-playhead" style={{ left: `${pct}%` }}>
            <div className="ev-playhead-knob" />
          </div>
        </div>
      </div>
    </div>
  );
}
