import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { palette, EASE } from "../theme";
import { FONT } from "../lib/fonts";
import { ApertureMark } from "../components/ApertureMark";
import { Wordmark } from "../components/Wordmark";
import { reveal, blurInStyle, punch } from "../lib/anim";

/** 27.8–32.4s: the iris opens; brand, tagline, URL. */
export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();

  const twist = interpolate(frame, [0, 42], [0, 44], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const ringProgress = reveal(frame, 4, 38);
  const markScale = punch(frame, 42, 0.07);

  const wm = reveal(frame, 48, 16);
  const tag = reveal(frame, 68, 16);
  const url = reveal(frame, 92, 12);
  const foot = reveal(frame, 104, 12);

  return (
    <AbsoluteFill style={{ background: palette.bg, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(60% 50% at 50% 44%, rgba(111,189,176,0.08) 0%, rgba(28,27,25,0) 60%)" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ transform: `scale(${markScale})` }}>
          <ApertureMark size={116} twist={twist} ringProgress={ringProgress} color={palette.ink} core={palette.accent} />
        </div>

        <div style={{ opacity: wm, transform: `translateY(${(1 - wm) * 12}px)` }}>
          <Wordmark size={76} />
        </div>

        <div
          style={{
            fontFamily: FONT.serif,
            fontSize: 44,
            fontWeight: 500,
            color: palette.ink,
            ...blurInStyle(tag, 8, 12),
          }}
        >
          One witness can lie. <em style={{ fontStyle: "italic", color: palette.accent }}>Five cannot.</em>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 16, letterSpacing: 3, color: palette.inkDim, opacity: url }}>
            open-eyes-angles.vercel.app
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, letterSpacing: 2.5, color: palette.muted, opacity: foot }}>
            ALIGNED WITH UN SDG 16 · PEACE, JUSTICE &amp; STRONG INSTITUTIONS
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
