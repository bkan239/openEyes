import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { TrustMeter } from "../components/TrustMeter";
import { reveal, blurInStyle, outAt, punch } from "../lib/anim";

/** 22.5–27.8s: the explainable trust score climbs 0.52 → 0.96. */
export const SceneTrust: React.FC = () => {
  const frame = useCurrentFrame();

  const value = interpolate(frame, [10, 30, 50, 70, 90, 110], [0.52, 0.608, 0.696, 0.784, 0.872, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barProgress = [0, 1, 2, 3, 4].map((i) => reveal(frame, 12 + i * 20, 12));
  const subT = reveal(frame, 74, 14);

  const block = reveal(frame, 4, 16);
  const extra = [30, 50, 70, 90, 110].reduce((acc, at) => acc + (punch(frame, at, 0.05) - 1), 0);
  const lockFlash = frame >= 110 && frame < 120 ? interpolate(frame, [110, 113, 120], [0, 0.4, 0]) : 0;
  const exit = outAt(frame, 146, 14);

  const cap = reveal(frame, 96, 14) * exit;

  return (
    <AbsoluteFill style={{ background: palette.bg, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(70% 60% at 50% 42%, rgba(111,189,176,0.07) 0%, rgba(28,27,25,0) 60%)" }} />

      <div
        style={{
          transform: `scale(${interpolate(block, [0, 1], [0.9, 1.25]) * (1 + extra)})`,
          opacity: block * exit,
          marginBottom: 60,
        }}
      >
        <TrustMeter value={value} barProgress={barProgress} subT={subT} numScale={1.15} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 250,
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 500,
          color: palette.ink,
          textAlign: "center",
          maxWidth: "22ch",
          lineHeight: 1.1,
          ...blurInStyle(cap, 8, 14),
          opacity: cap,
        }}
      >
        Not a verdict. A <em style={{ fontStyle: "italic", color: palette.accent }}>probability</em> you can audit.
      </div>

      <AbsoluteFill style={{ background: palette.accent, opacity: lockFlash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
