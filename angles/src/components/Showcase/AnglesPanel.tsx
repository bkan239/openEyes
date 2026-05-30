import { useApp } from "@/state/store";
import type { LivePerspective } from "@/state/useLivePerspectives";

function EyeIcon({ off }: { off: boolean }) {
  if (off)
    return (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M2 12s3.6-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.6 7-10 7c-1.6 0-3-.4-4.3-1" />
        <path d="M3 3l18 18" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PerspectiveCard({ p }: { p: LivePerspective }) {
  const showcaseVideoOpen = useApp((s) => s.showcaseVideoOpen);
  const setShowcaseVideoOpen = useApp((s) => s.setShowcaseVideoOpen);
  const setShowcasePinClickPx = useApp((s) => s.setShowcasePinClickPx);
  const setShowcasePanelSpawnAnchor = useApp((s) => s.setShowcasePanelSpawnAnchor);

  const { id, identity, status } = p;
  const live = status === "live";
  const open = !!showcaseVideoOpen[id];
  const statusLabel = status === "live" ? "● LIVE" : status === "waiting" ? "WAITING" : "ENDED";

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) {
      setShowcaseVideoOpen(id, false);
      return;
    }
    // Grow the floating clip out of the card it was launched from.
    const r = e.currentTarget.getBoundingClientRect();
    const anchor = { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    setShowcasePanelSpawnAnchor(id, anchor);
    setShowcasePinClickPx({ id, ...anchor });
    setShowcaseVideoOpen(id, true);
  };

  return (
    <button
      type="button"
      className={`ev-pcard${live ? " live" : ""}${open ? " open" : ""}`}
      onClick={onClick}
      aria-pressed={open}
      title={open ? "Hide this clip" : "Show this clip"}
    >
      <span className="ev-pcard-bar" style={{ background: live ? identity.color : "transparent" }} />
      <span className="ev-pcard-top">
        <span className="ev-avatar" style={{ background: identity.color }}>
          {identity.initial}
        </span>
        <span className="ev-pcard-meta">
          <span className="ev-pcard-name" style={{ display: "block" }}>
            {identity.handle}
          </span>
          <span className="ev-pcard-sub" style={{ display: "block" }}>
            {identity.device}
          </span>
        </span>
        <span className={`ev-pcard-status ${status}`}>{statusLabel}</span>
      </span>
      <span className="ev-film" style={{ opacity: live ? 1 : 0.45, display: "flex" }}>
        <span className="ev-film-hatch" />
        <span className="ev-film-accent" style={{ background: identity.color }} />
        <span className={`ev-film-tag${live ? " on" : ""}`}>{live ? "LIVE FEED" : "NO SIGNAL FEED"}</span>
      </span>
    </button>
  );
}

export function AnglesPanel({
  perspectives,
  total,
  liveCount
}: {
  perspectives: LivePerspective[];
  total: number;
  liveCount: number;
}) {
  const hidden = useApp((s) => s.showcaseFloatingVideosHidden);
  const toggleHidden = useApp((s) => s.toggleShowcaseFloatingVideosHidden);

  return (
    <div
      className="ev-panel"
      style={{
        position: "absolute",
        top: 92,
        right: 24,
        width: 374,
        maxHeight: "calc(100vh - 92px - 150px)",
        zIndex: 95
      }}
    >
      <div className="ev-panel-head">
        <div>
          <div className="ev-panel-kicker">All angles</div>
          <div className="ev-panel-title">{total} perspectives</div>
        </div>
        <button
          type="button"
          className={`ev-iconbtn${hidden ? "" : " active"}`}
          title={hidden ? "Show eyewitness clips" : "Hide eyewitness clips"}
          aria-pressed={!hidden}
          onClick={() => toggleHidden()}
        >
          <EyeIcon off={hidden} />
        </button>
      </div>
      <div className="ev-panel-list">
        {perspectives.map((p) => (
          <PerspectiveCard key={p.id} p={p} />
        ))}
      </div>
      <div className="ev-panel-foot">
        <span>Synced to timeline</span>
        <span className="live">{liveCount} live</span>
      </div>
    </div>
  );
}
