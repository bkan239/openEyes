import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/state/store";
import { isMockExcludedMediaId } from "@/lib/demo";
import {
  byPerspectiveOrder,
  perspectiveFor,
  statusForClip,
  type PerspectiveIdentity,
  type PerspectiveStatus
} from "@/lib/perspectives";
import type { UserMedia } from "@/lib/types";

export interface LivePerspective {
  id: string;
  media: UserMedia;
  identity: PerspectiveIdentity;
  status: PerspectiveStatus;
}

export interface LivePerspectivesState {
  perspectives: LivePerspective[];
  total: number;
  liveCount: number;
  /** Design trust model: 0.52 baseline + 0.088 per corroborating live source. */
  trust: number;
}

/**
 * The five Pretti perspectives, ordered + status-stamped against the live
 * playhead. Drives the masthead trust block and the ALL ANGLES panel, so they
 * always agree. A throttled rAF keeps statuses ticking while playback runs.
 */
export function useLivePerspectives(): LivePerspectivesState {
  const prettiOverlayItems = useApp((s) => s.prettiOverlayItems);
  const liveStart = useApp((s) => s.liveStart);
  const livePlayhead = useApp((s) => s.livePlayhead);
  const livePlaying = useApp((s) => s.livePlaying);

  const ordered = useMemo(
    () => byPerspectiveOrder(prettiOverlayItems.filter((m) => !isMockExcludedMediaId(m.id))),
    [prettiOverlayItems]
  );

  const [absMs, setAbsMs] = useState(() => liveStart + useApp.getState().currentLivePlayhead());
  const lastTickRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (now - lastTickRef.current > 90) {
        lastTickRef.current = now;
        const s = useApp.getState();
        setAbsMs(s.liveStart + s.currentLivePlayhead());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Snap immediately on scrub / bounds change (don't wait for the next rAF gate).
  useEffect(() => {
    setAbsMs(useApp.getState().liveStart + useApp.getState().currentLivePlayhead());
  }, [livePlayhead, liveStart, livePlaying]);

  const perspectives = useMemo<LivePerspective[]>(
    () =>
      ordered.map((media) => ({
        id: media.id,
        media,
        identity: perspectiveFor(media.id),
        status: liveStart > 0 ? statusForClip(media, absMs) : "waiting"
      })),
    [ordered, absMs, liveStart]
  );

  const liveCount = perspectives.filter((p) => p.status === "live").length;
  const trust = Math.min(0.98, 0.52 + liveCount * 0.088);

  return { perspectives, total: perspectives.length, liveCount, trust };
}
