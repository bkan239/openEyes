import React from "react";
import { AbsoluteFill } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";

/**
 * Stylized warm-ink street map of 26th & Nicollet — a vector grid (no MapLibre,
 * which can't render reliably in headless Chromium). Nicollet Ave runs vertically
 * through the camera cluster; cross streets run horizontal. Push-in is applied by
 * the parent scene.
 */
const W = 1920;
const H = 1080;
const AVE_X = 762; // Nicollet, centered on the camera cluster
const AVE_W = 92;

const crossYs = [150, 470, 770]; // horizontal cross streets

const Block: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => (
  <rect x={x} y={y} width={w} height={h} rx={3} fill={palette.mapBlock} opacity={0.9} />
);

export const MapBackdrop: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: palette.mapVoid, overflow: "hidden" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* city blocks (left + right of the avenue, between cross streets) */}
        {[-1, 0, 1, 2].map((row) =>
          [0, 1].map((side) => {
            const gap = 26;
            const y = -120 + row * 320;
            const bw = side === 0 ? AVE_X - AVE_W / 2 - 2 * gap : W - (AVE_X + AVE_W / 2) - 2 * gap;
            const x = side === 0 ? gap : AVE_X + AVE_W / 2 + gap;
            return <Block key={`${row}-${side}`} x={x} y={y + gap} w={bw} h={320 - 2 * gap} />;
          })
        )}

        {/* cross streets */}
        {crossYs.map((y, i) => (
          <rect key={i} x={0} y={y} width={W} height={i === 1 ? 64 : 46} fill={palette.mapStreet} />
        ))}
        {/* the avenue */}
        <rect x={AVE_X - AVE_W / 2} y={0} width={AVE_W} height={H} fill={palette.mapStreetMajor} />
        {/* avenue centre dashes */}
        <line
          x1={AVE_X}
          y1={0}
          x2={AVE_X}
          y2={H}
          stroke={palette.muted}
          strokeWidth={2}
          strokeOpacity={0.35}
          strokeDasharray="14 18"
        />
        {/* labels */}
        <text
          x={AVE_X - AVE_W / 2 - 16}
          y={250}
          fill={palette.muted}
          opacity={0.6}
          fontFamily={FONT.mono}
          fontSize={15}
          letterSpacing={4}
          transform={`rotate(-90 ${AVE_X - AVE_W / 2 - 16} 250)`}
        >
          NICOLLET AVE
        </text>
        <text x={70} y={crossYs[1] - 14} fill={palette.muted} opacity={0.55} fontFamily={FONT.mono} fontSize={14} letterSpacing={4}>
          E 26TH ST
        </text>
      </svg>

      {/* warm multiply tint pulling the cool grid into ink (mirrors .ev-map-tint) */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, rgba(28,27,25,0) 0%, rgba(22,19,16,0.34) 70%, rgba(22,19,16,0.64) 100%), linear-gradient(0deg, rgba(40,30,18,0.18), rgba(40,30,18,0.18))",
          mixBlendMode: "multiply",
        }}
      />
    </AbsoluteFill>
  );
};
