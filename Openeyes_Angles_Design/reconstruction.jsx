/* reconstruction.jsx — basemap, perspectives (A–E), view cones, helpers.
   Model: 5 equal camera perspectives, each with its own curated colour. */

const VB = { w: 1200, h: 800 };
const DURATION = 120; // seconds  (09:00:00 → 09:02:00)
const VICTIM = { x: 662, y: 402 };

// ---- single-colour themes (one hue, subtle shade ramp = unified, not rainbow) ----
const PALETTE_LIST = [
  { key: "teal",     label: "Petrol (brand)", colors: ["#bfe6df", "#97d3c8", "#6FBDB0", "#52a597", "#3f8a7d"] },
  { key: "platinum", label: "Platinum", colors: ["#eef0ec", "#d6dad2", "#bcc2b8", "#a3ab9e", "#8a9486"] },
  { key: "azure",    label: "Azure",    colors: ["#a9c8f5", "#8eb4ef", "#74a0e6", "#5d8edb", "#4b7dc9"] },
  { key: "amber",    label: "Amber",    colors: ["#f0d493", "#ecc36a", "#e6b257", "#d8a046", "#c68e3b"] },
];
function paletteByKey(k) { return (PALETTE_LIST.find((p) => p.key === k) || PALETTE_LIST[0]).colors; }

// ---- the five perspectives (uploaded from contributor accounts) ----
const PERSPECTIVES = [
  { id: "A", initial: "M", handle: "@marisol.vega", device: "iPhone 14 · vertical", x: 524, y: 258, face: 46,  half: 23, r: 150, win: [2, 120] },
  { id: "B", initial: "D", handle: "@deshawn_k",    device: "Pixel 7 · handheld",  x: 470, y: 476, face: -18, half: 22, r: 138, win: [30, 114] },
  { id: "C", initial: "R", handle: "@rfuentes.mn",  device: "Dashcam · forward",   x: 842, y: 300, face: 152, half: 23, r: 150, win: [26, 74] },
  { id: "D", initial: "A", handle: "@a.nordstrom",  device: "Bodycam · clip-on",   x: 566, y: 360, face: 22,  half: 21, r: 132, win: [30, 86] },
  { id: "E", initial: "J", handle: "@jjokafor",     device: "Transit cam · fixed", x: 858, y: 504, face: 207, half: 22, r: 138, win: [52, 84] },
];

// ---- helpers ----
function sector(cx, cy, faceDeg, halfDeg, r) {
  const a0 = ((faceDeg - halfDeg) * Math.PI) / 180;
  const a1 = ((faceDeg + halfDeg) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
}
function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function statusAt(win, t) {
  if (t < win[0]) return "waiting";
  if (t > win[1]) return "ended";
  return "live";
}
function activeAlpha(win, t) {
  const fade = 4;
  if (t <= win[0] - fade || t >= win[1] + fade) return 0;
  let a = 1;
  if (t < win[0]) a = (t - (win[0] - fade)) / fade;
  if (t > win[1]) a = ((win[1] + fade) - t) / fade;
  return Math.max(0, Math.min(1, a));
}

// ---- basemap ----
function Basemap() {
  return (
    <g>
      <g opacity="0.9">
        <rect className="blk" x="120" y="120" width="300" height="190" rx="3" />
        <rect className="blk-2" x="120" y="340" width="300" height="150" rx="3" />
        <rect className="blk" x="120" y="520" width="300" height="210" rx="3" />
        <rect className="blk-2" x="690" y="120" width="250" height="190" rx="3" />
        <rect className="blk" x="690" y="470" width="250" height="120" rx="3" />
        <rect className="blk-2" x="980" y="150" width="180" height="220" rx="3" />
        <rect className="blk" x="980" y="430" width="180" height="300" rx="3" />
        <rect className="blk-2" x="430" y="600" width="200" height="130" rx="3" />
      </g>
      <g>
        <line className="road-major" x1="650" y1="-40" x2="650" y2="840" strokeWidth="74" />
        <line className="road" x1="958" y1="-40" x2="958" y2="840" strokeWidth="52" />
        <line className="road" x1="-40" y1="612" x2="1240" y2="612" strokeWidth="52" />
        <line className="road" x1="-40" y1="96" x2="1240" y2="96" strokeWidth="44" />
      </g>
      <g>
        <line className="lane-dash" x1="650" y1="-40" x2="650" y2="840" />
        <line className="lane-dash" x1="958" y1="-40" x2="958" y2="840" />
        <line className="lane-dash" x1="-40" y1="612" x2="1240" y2="612" />
      </g>
      <text className="street-label" x="636" y="250" transform="rotate(-90 636 250)">NICOLLET AVENUE</text>
      <text className="street-label" x="944" y="690" transform="rotate(-90 944 690)">1ST AVENUE</text>
      <text className="street-label" x="250" y="600">7TH STREET</text>
    </g>
  );
}

// ---- one perspective (cone + lettered marker) ----
function Perspective({ p, color, t, showCones }) {
  const alpha = activeAlpha(p.win, t);
  const st = statusAt(p.win, t);
  const live = st === "live";
  const dim = live ? 1 : 0.45;
  if (alpha <= 0 && !live) {
    // keep faint marker even when out of window so the scene stays legible
  }
  const sweep = Math.sin((t + p.x) / 14) * 4;
  const face = p.face + sweep;

  return (
    <g className="actor" style={{ opacity: live ? 1 : 0.5 }}>
      {showCones && (
        <g style={{ opacity: live ? 1 : 0.4 }}>
          <path d={sector(p.x, p.y, face, p.half, p.r)} fill={color} fillOpacity={live ? 0.14 : 0.07} />
          <path d={sector(p.x, p.y, face, p.half, p.r * 0.6)} fill={color} fillOpacity={live ? 0.16 : 0.07} />
          <path d={sector(p.x, p.y, face, p.half, p.r)} fill="none" stroke={color} strokeWidth="1" opacity={live ? 0.55 : 0.25} />
        </g>
      )}
      {live && <circle cx={p.x} cy={p.y} r="22" fill="none" stroke={color} strokeWidth="1.4" className="dot-pulse" />}
      <circle cx={p.x} cy={p.y} r="14" fill={live ? color : "#221F1B"} stroke={color} strokeWidth="1.8" />
      <text x={p.x} y={p.y + 4} textAnchor="middle" className="marker-letter"
            fill={live ? "#161310" : color} style={{ opacity: dim }}>{p.initial}</text>
    </g>
  );
}

window.Reconstruction = {
  VB, DURATION, VICTIM, PALETTE_LIST, paletteByKey, PERSPECTIVES,
  sector, fmtClock, statusAt, activeAlpha, Basemap, Perspective,
};
