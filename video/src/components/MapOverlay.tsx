import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { PERSPS, VICTIM } from "../lib/perspectives";
import { project, bearingTo } from "../lib/geo";
import { reveal } from "../lib/anim";

const W = 1920;
const H = 1080;
const HALF = 13; // degrees
const CONE_GAP = 6; // stop the apex just short of the focus dot

const v = project(VICTIM.xm, VICTIM.ym);

function conePath(px: number, py: number, deg: number, len: number, half: number): string {
  const a0 = ((deg - half) * Math.PI) / 180;
  const a1 = ((deg + half) * Math.PI) / 180;
  const x0 = px + len * Math.cos(a0);
  const y0 = py + len * Math.sin(a0);
  const x1 = px + len * Math.cos(a1);
  const y1 = py + len * Math.sin(a1);
  return `M ${px} ${py} L ${x0} ${y0} A ${len} ${len} 0 0 1 ${x1} ${y1} Z`;
}

/**
 * The incident layer over the map: the cream victim marker, the five camera
 * pins, and their view-cones sweeping to point at the victim. Each cone reveals
 * from its own `fireFrames[i]`; the victim from `victimFrame`.
 */
export const MapOverlay: React.FC<{
  frame: number;
  fireFrames: number[];
  victimFrame: number;
  showHandles?: boolean;
}> = ({ frame, fireFrames, victimFrame, showHandles = true }) => {
  const vt = reveal(frame, victimFrame, 16);
  const ringPulse = ((frame - victimFrame) % 78) / 78; // ~2.6s loop @30fps
  const ringScale = interpolate(ringPulse, [0, 1], [0.5, 1.6], { extrapolateLeft: "clamp" });
  const ringOpacity = interpolate(ringPulse, [0, 0.7, 1], [0.55, 0, 0]) * vt;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {PERSPS.map((p) => (
            <radialGradient key={p.id} id={`cone-${p.initial}`} cx="0%" cy="50%" r="100%">
              <stop offset="0%" stopColor={p.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={p.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* cones (behind pins) — each terminates AT the focus point so every
            camera visibly looks at the same spot, never overshooting. */}
        {PERSPS.map((p, i) => {
          const { x, y } = project(p.xm, p.ym);
          const deg = bearingTo(x, y, v.x, v.y);
          const dist = Math.max(0, Math.hypot(v.x - x, v.y - y) - CONE_GAP);
          const t = reveal(frame, fireFrames[i], 18);
          if (t <= 0) return null;
          const len = dist * t;
          const half = interpolate(t, [0, 1], [3, HALF]);
          return (
            <path
              key={p.id}
              d={conePath(x, y, deg, len, half)}
              fill={`url(#cone-${p.initial})`}
              stroke={p.color}
              strokeOpacity={0.5 * t}
              strokeWidth={1.5}
              opacity={t}
            />
          );
        })}

        {/* victim ring + dot */}
        <circle cx={v.x} cy={v.y} r={22 * ringScale} fill="none" stroke={palette.victim} strokeWidth={1.4} opacity={ringOpacity} />
        <circle cx={v.x} cy={v.y} r={7} fill={palette.victim} opacity={vt} />
        <circle cx={v.x} cy={v.y} r={2.4} fill={palette.mapVoid} opacity={vt} />
        {vt > 0.4 && (
          <text x={v.x + 16} y={v.y + 4} fill={palette.victim} fontFamily={FONT.mono} fontSize={15} fontWeight={600} letterSpacing={2.4} opacity={vt}>
            {VICTIM.label}
          </text>
        )}

        {/* pins + handles */}
        {PERSPS.map((p, i) => {
          const { x, y } = project(p.xm, p.ym);
          const t = reveal(frame, fireFrames[i], 10);
          if (t <= 0) return null;
          return (
            <g key={p.id} opacity={t}>
              <circle cx={x} cy={y} r={13} fill={p.color} opacity={0.18} />
              <circle cx={x} cy={y} r={6.5} fill={p.color} />
              <circle cx={x} cy={y} r={6.5} fill="none" stroke={palette.mapVoid} strokeWidth={1.5} />
              {showHandles && (
                <text x={x + 14} y={y - 9} fill={palette.ink} fontFamily={FONT.mono} fontSize={13.5} letterSpacing={1.2}>
                  {p.initial}
                  <tspan fill={palette.inkDim}>{`  ${p.handle}`}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
