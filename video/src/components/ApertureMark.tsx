import React from "react";

/**
 * OpenEyes aperture mark — copied from angles/src/components/brand/ApertureMark.tsx
 * (N=6, twist=44°). Extended with animatable `twist` + `ringProgress` so the
 * outro can "open the iris" and draw the ring on.
 */
const N = 6;
const HR = 17.5;
const R = 50;
const SW = 4.4;
const BASE = 90;

function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [60 + r * Math.cos(a), 60 - r * Math.sin(a)];
}

export const ApertureMark: React.FC<{
  size?: number;
  twist?: number;
  core?: string;
  color?: string;
  /** 0→1 stroke-draw of the outer ring. */
  ringProgress?: number;
  bladeOpacity?: number;
}> = ({ size = 120, twist = 44, core = "currentColor", color = "currentColor", ringProgress = 1, bladeOpacity = 0.62 }) => {
  const blades = Array.from({ length: N }, (_, k) => {
    const [bx, by] = pt(HR, BASE + (360 / N) * k);
    const [ax, ay] = pt(R, BASE + (360 / N) * k + twist);
    return { bx, by, ax, ay, k };
  });
  const hex = "M" + blades.map(({ bx, by }) => `${bx.toFixed(2)},${by.toFixed(2)}`).join(" L") + " Z";
  const C = 2 * Math.PI * R;

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ display: "block", flex: "none", overflow: "visible" }}>
      <circle
        cx={60}
        cy={60}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeDasharray={C}
        strokeDashoffset={C * (1 - ringProgress)}
        transform="rotate(-90 60 60)"
      />
      {blades.map(({ bx, by, ax, ay, k }) => (
        <line key={k} x1={bx} y1={by} x2={ax} y2={ay} stroke={color} strokeWidth={SW * 0.82} strokeLinecap="round" opacity={bladeOpacity} />
      ))}
      <path d={hex} fill={core} stroke={core === "none" ? color : "none"} strokeWidth={core === "none" ? SW : undefined} />
    </svg>
  );
};
