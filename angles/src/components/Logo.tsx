/**
 * OpenEyes "Aperture-Auge" logo.
 *
 * A camera aperture that reads as an iris/eye, with a red pupil at the center
 * (the "recording" spark). Geometry mirrors brand/openeyes-mark.svg exactly —
 * edit the generator (brand/_gen_logo.py) and copy the coordinates if you
 * change the shape. The blades inherit `currentColor` so the mark themes to
 * wherever it sits; the pupil keeps the brand red.
 */

const PUPIL = "#F2353A";

type MarkProps = {
  size?: number;
  /** Pupil fill. Defaults to the brand red; pass "currentColor" for monochrome. */
  pupil?: string;
  title?: string;
  className?: string;
};

export function LogoMark({ size = 18, pupil = PUPIL, title = "OpenEyes", className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="60" cy="60" r="47" stroke="currentColor" strokeWidth="3.2" />
      <g stroke="currentColor" strokeWidth="3.0" strokeLinecap="round">
        <line x1="60.000" y1="39.000" x2="106.626" y2="65.919" />
        <line x1="78.187" y1="49.500" x2="78.187" y2="103.339" />
        <line x1="78.187" y1="70.500" x2="31.561" y2="97.419" />
        <line x1="60.000" y1="81.000" x2="13.374" y2="54.081" />
        <line x1="41.813" y1="70.500" x2="41.813" y2="16.661" />
        <line x1="41.813" y1="49.500" x2="88.439" y2="22.581" />
      </g>
      <path
        d="M60.000,39.000 L78.187,49.500 L78.187,70.500 L60.000,81.000 L41.813,70.500 L41.813,49.500 Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M60.000,52.400 L67.600,60.000 L60.000,67.600 L52.400,60.000 Z" fill={pupil} />
    </svg>
  );
}

type LogoProps = {
  /** Mark glyph height in px. The wordmark scales relative to it. */
  size?: number;
  /** Color of the "open" half of the wordmark. */
  openColor?: string;
  /** Color of the "eyes" half of the wordmark. */
  eyesColor?: string;
  className?: string;
};

/** Full horizontal lockup: aperture mark + "openeyes" wordmark. */
export function Logo({
  size = 28,
  openColor = "var(--ink, #E9EEF7)",
  eyesColor = "var(--accent, #33CFC8)",
  className,
}: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4, color: openColor }}
    >
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: 'var(--font-sans, "Hanken Grotesk", -apple-system, sans-serif)',
          fontWeight: 800,
          fontSize: size * 0.86,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        <span style={{ color: openColor }}>open</span>
        <span style={{ color: eyesColor }}>eyes</span>
      </span>
    </span>
  );
}
