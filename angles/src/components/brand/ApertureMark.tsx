/**
 * OpenEyes aperture mark — the camera-iris logo that opens onto a core.
 *
 * Colour-adaptive: strokes use `currentColor`, so the mark inherits whatever
 * text colour it sits in (e.g. the teal `--accent` in the event eyebrow).
 * Pass `core` to override the centre fill — e.g. the brand red `#ff453a`.
 *
 * Geometry mirrors brand/aperture.py (N=6, twist=44°). Keep them in sync.
 */
type Props = {
  size?: number;
  /** Centre fill. Defaults to currentColor; pass a colour for the brand core, or "none" for an open core. */
  core?: string;
  /** Accessible label; omit for a purely decorative mark. */
  title?: string;
};

const N = 6;
const TWIST = 44;
const HR = 17.5;
const R = 50;
const SW = 4.4;
const BASE = 90;

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [60 + r * Math.cos(a), 60 - r * Math.sin(a)];
}

export function ApertureMark({ size = 16, core = "currentColor", title }: Props) {
  const blades = Array.from({ length: N }, (_, k) => {
    const [bx, by] = pt(HR, BASE + (360 / N) * k);
    const [ax, ay] = pt(R, BASE + (360 / N) * k + TWIST);
    return { bx, by, ax, ay, k };
  });
  const hex =
    "M" +
    blades.map(({ bx, by }) => `${bx.toFixed(2)},${by.toFixed(2)}`).join(" L") +
    " Z";

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flex: "none" }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx={60} cy={60} r={R} fill="none" stroke="currentColor" strokeWidth={SW} />
      {blades.map(({ bx, by, ax, ay, k }) => (
        <line
          key={k}
          x1={bx}
          y1={by}
          x2={ax}
          y2={ay}
          stroke="currentColor"
          strokeWidth={SW * 0.82}
          strokeLinecap="round"
          opacity={0.62}
        />
      ))}
      <path d={hex} fill={core} stroke={core === "none" ? "currentColor" : "none"} strokeWidth={core === "none" ? SW : undefined} />
    </svg>
  );
}

export default ApertureMark;
