import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, interpolate } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { PERSPS } from "../lib/perspectives";
import { reveal, blurInStyle, outAt } from "../lib/anim";

// deterministic scatter of grey "clip" cards
const CARDS = Array.from({ length: 20 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin(i * 99.7 + n * 13.1) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    id: PERSPS[i % PERSPS.length].id,
    x: 4 + r(1) * 88,
    y: 2 + r(2) * 90,
    rot: (r(3) - 0.5) * 26,
    scale: 0.6 + r(4) * 0.8,
    depth: 0.3 + r(5) * 0.7,
    phase: r(6) * Math.PI * 2,
  };
});

/** 4–8s: the chaos of unverifiable footage. Captions carry the problem. */
export const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const inAll = reveal(frame, 0, 18);
  const exit = outAt(frame, 104, 16);

  const beat1 = reveal(frame, 4, 14) * outAt(frame, 54, 10);
  const beat2 = reveal(frame, 64, 14) * exit;

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: "hidden" }}>
      {/* drifting grey grid */}
      <AbsoluteFill style={{ opacity: inAll * 0.9 }}>
        {CARDS.map((c, i) => {
          const drift = Math.sin(frame * 0.03 + c.phase) * 14 * c.depth;
          const w = 150 * c.scale;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: w,
                height: (w * 16) / 9,
                borderRadius: 10,
                overflow: "hidden",
                transform: `translate(-50%, -50%) translateY(${drift}px) rotate(${c.rot}deg)`,
                border: `1px solid rgba(252,251,248,0.06)`,
                filter: `grayscale(1) brightness(0.5) contrast(0.9)`,
                opacity: 0.5 * c.depth + 0.2,
                boxShadow: "0 18px 40px -24px rgba(0,0,0,0.8)",
              }}
            >
              <Img src={staticFile(`thumbs/${c.id}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* darkening so captions read */}
      <AbsoluteFill style={{ background: "radial-gradient(110% 80% at 50% 50%, rgba(28,27,25,0.55) 0%, rgba(28,27,25,0.86) 70%)" }} />

      {/* caption beats */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", fontFamily: FONT.serif, fontSize: 64, fontWeight: 500, color: palette.ink, textAlign: "center", maxWidth: "20ch", lineHeight: 1.08, ...blurInStyle(beat1, 10, 16), opacity: beat1 }}>
          A <em style={{ fontStyle: "italic", color: palette.accent }}>lie</em> spreads before the truth loads.
        </div>
        <div style={{ position: "absolute", fontFamily: FONT.serif, fontSize: 64, fontWeight: 500, color: palette.ink, textAlign: "center", maxWidth: "20ch", lineHeight: 1.08, ...blurInStyle(beat2, 10, 16), opacity: beat2 }}>
          And real footage gets called <em style={{ fontStyle: "italic", color: palette.accent }}>fake</em>.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
