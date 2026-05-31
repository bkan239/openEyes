/* app.jsx — App shell: map, ALL ANGLES panel, synced timeline, tweaks. */

const { useState, useEffect, useRef, useCallback } = React;
const R = window.Reconstruction;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "teal",
  "headline": "serif",
  "showCones": true,
  "showPanel": true
}/*EDITMODE-END*/;

function Icon({ name }) {
  if (name === "center") return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
      <path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
  if (name === "eye") return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
  if (name === "eye-off") return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 12s3.6-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.6 7-10 7c-1.6 0-3-.4-4.3-1" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
  if (name === "play") return (<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>);
  if (name === "pause") return (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1" /><rect x="13.8" y="4.5" width="4.2" height="15" rx="1" /></svg>);
  return null;
}

// filmstrip placeholder (user drops real footage here)
function Filmstrip({ color, live }) {
  return (
    <div className="film" style={{ opacity: live ? 1 : 0.4 }}>
      <div className="film-hatch" />
      <div className="film-accent" style={{ background: color }} />
      <span className="film-tag">NO SIGNAL FEED</span>
    </div>
  );
}

function PerspectiveCard({ p, color, status }) {
  const live = status === "live";
  return (
    <div className={`pcard ${live ? "live" : ""}`}>
      <div className="pcard-bar" style={{ background: live ? color : "transparent" }} />
      <div className="pcard-top">
        <div className="avatar" style={{ background: color }}>{p.initial}</div>
        <div className="pcard-meta">
          <div className="pcard-name">{p.handle}</div>
          <div className="pcard-sub">{p.device}</div>
        </div>
        <div className={`pcard-status ${status}`}>
          {status === "live" ? "● LIVE" : status === "waiting" ? "WAITING" : "ENDED"}
        </div>
      </div>
      <Filmstrip color={color} live={live} />
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [time, setTime] = useState(48);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });

  const colors = R.paletteByKey(t.palette);
  const colorOf = (i) => colors[i % colors.length];

  useEffect(() => { document.documentElement.style.setProperty("--accent", colors[2] || colors[0]); }, [t.palette]);

  const svgRef = useRef(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  // playback
  useEffect(() => {
    if (!playing) return;
    lastRef.current = performance.now();
    const tick = (now) => {
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      setTime((prev) => {
        const next = prev + dt * 8;
        if (next >= R.DURATION) { setPlaying(false); return R.DURATION; }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const recenter = useCallback(() => setView({ scale: 1, tx: 0, ty: 0 }), []);
  const zoom = useCallback((dir) => setView((v) => ({ ...v, scale: Math.max(0.6, Math.min(3, v.scale * (dir > 0 ? 1.25 : 0.8))) })), []);

  // pan
  const panRef = useRef(null);
  const onDown = (e) => { panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }; svgRef.current.classList.add("dragging"); svgRef.current.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!panRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const f = R.VB.w / rect.width;
    setView((v) => ({ ...v, tx: panRef.current.tx + (e.clientX - panRef.current.x) * f, ty: panRef.current.ty + (e.clientY - panRef.current.y) * f }));
  };
  const onUp = () => { panRef.current = null; svgRef.current && svgRef.current.classList.remove("dragging"); };

  const cx = R.VB.w / 2, cy = R.VB.h / 2;
  const worldT = `translate(${(cx * (1 - view.scale) + view.tx).toFixed(2)} ${(cy * (1 - view.scale) + view.ty).toFixed(2)}) scale(${view.scale})`;

  // scrub
  const scrubRef = useRef(null);
  const scrubTo = (clientX) => { const r = scrubRef.current.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width)); setTime(p * R.DURATION); };
  const onScrubDown = (e) => { setPlaying(false); scrubRef.current.setPointerCapture(e.pointerId); scrubRef.current._drag = true; scrubTo(e.clientX); };
  const onScrubMove = (e) => { if (scrubRef.current && scrubRef.current._drag) scrubTo(e.clientX); };
  const onScrubUp = () => { if (scrubRef.current) scrubRef.current._drag = false; };

  const pct = (time / R.DURATION) * 100;
  const liveCount = R.PERSPECTIVES.filter((p) => R.statusAt(p.win, time) === "live").length;
  const trust = Math.min(0.98, 0.52 + liveCount * 0.088);

  return (
    <div className="stage">
      <svg ref={svgRef} className="map-svg" viewBox={`0 0 ${R.VB.w} ${R.VB.h}`} preserveAspectRatio="xMidYMid slice"
           onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <rect x="-200" y="-200" width={R.VB.w + 400} height={R.VB.h + 400} fill="var(--map-void)" />
        <g transform={worldT}>
          <R.Basemap />
          {/* incident / victim focus */}
          <circle cx={R.VICTIM.x} cy={R.VICTIM.y} r="20" fill="none" stroke="var(--victim)" strokeWidth="1.2" className="dot-pulse" />
          <circle cx={R.VICTIM.x} cy={R.VICTIM.y} r="6.5" fill="var(--victim)" />
          <circle cx={R.VICTIM.x} cy={R.VICTIM.y} r="2.4" fill="#161310" />
          <text x={R.VICTIM.x + 18} y={R.VICTIM.y + 4} className="victim-label">A. PRETTI</text>
          {R.PERSPECTIVES.map((p, i) => (
            <R.Perspective key={p.id} p={p} color={colorOf(i)} t={time} showCones={t.showCones} />
          ))}
        </g>
      </svg>

      {/* masthead */}
      <div className="hud topbar">
        <div className="eyebrow mono">
          OpenEyes<span className="sep"></span>Verified Event<span className="dim">· MPLS-0419</span>
        </div>
        <h1 className={`headline ${t.headline === "grotesk" ? "grotesk" : "serif"}`}>
          {t.headline === "grotesk"
            ? <>Five angles. <em>One</em> truth.</>
            : <>The killing of Alex&nbsp;Pretti, <em>corroborated</em>.</>}
        </h1>
        <div className="dateline mono">
          <span>MINNEAPOLIS · NICOLLET AVE</span><span className="dot"></span>
          <span>09:00 CDT</span><span className="dot"></span>
          <span>{liveCount} of {R.PERSPECTIVES.length} angles live</span>
        </div>
        <div className="trust">
          <div className="trust-num serif">{trust.toFixed(2)}</div>
          <div className="trust-meta">
            <div className="trust-label mono">Trust index · corroboration</div>
            <div className="trust-bars">
              {R.PERSPECTIVES.map((p, i) => (
                <i key={p.id} className={R.statusAt(p.win, time) === "live" ? "" : "off"}></i>
              ))}
            </div>
            <div className="trust-sub">{liveCount} independent sources · audio-synced · no tampering</div>
          </div>
        </div>
      </div>

      {/* top-right controls */}
      <button className="hud pill center-pill" onClick={recenter}><Icon name="center" />Center again</button>

      {/* ALL ANGLES panel */}
      {t.showPanel && (
        <div className="hud panel">
          <div className="panel-head">
            <div>
              <div className="panel-kicker">All angles</div>
              <div className="panel-title">{R.PERSPECTIVES.length} perspectives</div>
            </div>
            <button className={`icon-btn ${t.showCones ? "active" : ""}`} title="Toggle sightlines"
                    onClick={() => setTweak("showCones", !t.showCones)}>
              <Icon name={t.showCones ? "eye" : "eye-off"} />
            </button>
          </div>
          <div className="panel-list">
            {R.PERSPECTIVES.map((p, i) => (
              <PerspectiveCard key={p.id} p={p} color={colorOf(i)} status={R.statusAt(p.win, time)} />
            ))}
          </div>
          <div className="panel-foot">
            <span>Synced to timeline</span>
            <span className="panel-live">{liveCount} live</span>
          </div>
        </div>
      )}

      {/* zoom */}
      <div className="hud zoom">
        <button onClick={() => zoom(1)}>+</button>
        <button onClick={() => zoom(-1)}>−</button>
      </div>

      {/* scale */}
      <div className="hud scalebar"><span>5 m</span><div className="bar" /></div>

      {/* timeline */}
      <div className="hud timeline" style={{ right: t.showPanel ? 412 : 24 }}>
        <div className="tl-head">
          <span className="tl-end">09:00 AM</span>
          <span className="tl-now">{R.fmtClock(time)}</span>
          <span className="tl-end">09:02 AM</span>
        </div>
        <div className="tl-body">
          <button className="tl-play" onClick={() => setPlaying((p) => !p)}><Icon name={playing ? "pause" : "play"} /></button>
          <div className="tl-letters">
            {R.PERSPECTIVES.map((p, i) => (
              <span key={p.id} style={{ color: colorOf(i), opacity: R.statusAt(p.win, time) === "live" ? 1 : 0.5 }}>{p.initial}</span>
            ))}
          </div>
          <div className="tl-lanes">
            {R.PERSPECTIVES.map((p, i) => {
              const left = (p.win[0] / R.DURATION) * 100;
              const w = ((p.win[1] - p.win[0]) / R.DURATION) * 100;
              const live = R.statusAt(p.win, time) === "live";
              return (
                <div className="lane" key={p.id}>
                  <div className="lane-fill" style={{ left: `${left}%`, width: `${w}%`, background: colorOf(i), opacity: live ? 0.95 : 0.5 }} />
                </div>
              );
            })}
            <div className="tl-scrub" ref={scrubRef} onPointerDown={onScrubDown} onPointerMove={onScrubMove} onPointerUp={onScrubUp}>
              <div className="tl-track" />
              <div className="tl-track-done" style={{ width: `${pct}%` }} />
            </div>
            <div className="playhead" style={{ left: `${pct}%` }}><div className="playhead-knob" /></div>
          </div>
        </div>
      </div>

      {/* tweaks */}
      <TweaksPanel>
        <TweakSection label="Editorial" />
        <TweakRadio label="Headline" value={t.headline}
          options={["serif", "grotesk"]}
          onChange={(v) => setTweak("headline", v)} />
        <TweakSection label="Perspective colour" />
        <TweakSelect label="Single colour" value={t.palette}
          options={R.PALETTE_LIST.map((p) => ({ value: p.key, label: p.label }))}
          onChange={(v) => setTweak("palette", v)} />
        <TweakSection label="Overlay" />
        <TweakToggle label="Sightline cones" value={t.showCones} onChange={(v) => setTweak("showCones", v)} />
        <TweakToggle label="Angles panel" value={t.showPanel} onChange={(v) => setTweak("showPanel", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
