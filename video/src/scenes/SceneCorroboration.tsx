import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { palette, ramp } from "../theme";
import { FONT } from "../lib/fonts";
import { reveal, blurInStyle, outAt } from "../lib/anim";

const CX = 960;
const CY = 460;
const RAD = 300;
const ANGLES = [-90, -22, 44, 128, 212]; // degrees around the centre
const FIRE = [10, 24, 38, 52, 66];

/** 8–13.5s: one claim → five converging proofs. */
export const SceneCorroboration: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const beat1 = reveal(frame, 8, 14) * outAt(frame, 74, 10);
  const beat2 = reveal(frame, 84, 14);
  const exit = outAt(frame, 150, 14);

  const centreT = spring({ frame: frame - 2, fps, config: { damping: 16 } });
  const connectedAt = FIRE[4] + 18;
  const flash = frame >= connectedAt && frame < connectedAt + 10 ? interpolate(frame, [connectedAt, connectedAt + 3, connectedAt + 10], [0, 0.5, 0]) : 0;
  const pulseP = frame > connectedAt ? ((frame - connectedAt) % 70) / 70 : 1;
  const pulseScale = interpolate(pulseP, [0, 1], [0.4, 1.7]);
  const pulseOp = interpolate(pulseP, [0, 0.7, 1], [0.5, 0, 0]);

  const pushScale = interpolate(frame, [140, 165], [1, 1.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: palette.bg, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ opacity: exit, transform: `scale(${pushScale})` }}>
        <svg width={1920} height={1080} style={{ display: "block", overflow: "visible" }}>
          {/* connector lines */}
          {ANGLES.map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const x = CX + RAD * Math.cos(a);
            const y = CY + RAD * Math.sin(a);
            const len = Math.hypot(x - CX, y - CY);
            const t = reveal(frame, FIRE[i] + 2, 16);
            return (
              <line
                key={`l${i}`}
                x1={x}
                y1={y}
                x2={CX}
                y2={CY}
                stroke={ramp[i]}
                strokeWidth={2}
                strokeOpacity={0.6 * t}
                strokeDasharray={len}
                strokeDashoffset={len * (1 - t)}
              />
            );
          })}
          {/* outer dots */}
          {ANGLES.map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const x = CX + RAD * Math.cos(a);
            const y = CY + RAD * Math.sin(a);
            const s = spring({ frame: frame - FIRE[i], fps, config: { damping: 14, mass: 0.6 } });
            if (s <= 0) return null;
            return (
              <g key={`d${i}`} opacity={s}>
                <circle cx={x} cy={y} r={20} fill={ramp[i]} opacity={0.16} />
                <circle cx={x} cy={y} r={9} fill={ramp[i]} />
              </g>
            );
          })}
          {/* centre pulse + point */}
          <circle cx={CX} cy={CY} r={26 * pulseScale} fill="none" stroke={palette.victim} strokeWidth={1.6} opacity={pulseOp} />
          <circle cx={CX} cy={CY} r={10 * centreT} fill={palette.victim} />
          <circle cx={CX} cy={CY} r={3 * centreT} fill={palette.mapVoid} />
        </svg>
        <AbsoluteFill style={{ background: palette.victim, opacity: flash }} />
      </AbsoluteFill>

      {/* captions */}
      <div style={{ position: "absolute", bottom: 220, fontFamily: FONT.serif, fontSize: 60, fontWeight: 500, color: palette.ink, ...blurInStyle(beat1, 8, 14), opacity: beat1 }}>
        One angle is a claim.
      </div>
      <div style={{ position: "absolute", bottom: 220, fontFamily: FONT.serif, fontSize: 60, fontWeight: 500, color: palette.ink, ...blurInStyle(beat2, 8, 14), opacity: beat2 * exit }}>
        Five that line up are <em style={{ fontStyle: "italic", color: palette.accent }}>proof</em>.
      </div>
    </AbsoluteFill>
  );
};
