import React from "react";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { ApertureMark } from "./ApertureMark";
import { reveal, blurInStyle, wipeStyle } from "../lib/anim";

const Dot = () => <span style={{ width: 3, height: 3, borderRadius: 999, background: palette.muted, display: "inline-block" }} />;

/** Event masthead — eyebrow + serif headline + dateline (mirrors .ev-topbar). */
export const Masthead: React.FC<{ frame: number; liveCount: number }> = ({ frame, liveCount }) => {
  const eb = reveal(frame, 6, 14);
  const hl = reveal(frame, 16, 16);
  const dl = reveal(frame, 34, 14);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "34px 40px 90px",
        background: "linear-gradient(180deg, rgba(22,19,16,0.96) 0%, rgba(22,19,16,0.72) 46%, rgba(22,19,16,0) 100%)",
        pointerEvents: "none",
      }}
    >
      {/* eyebrow */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: FONT.mono, fontSize: 13, letterSpacing: 3.4, textTransform: "uppercase", color: palette.accent, fontWeight: 500, opacity: eb }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: palette.accent }}>
          <ApertureMark size={17} color={palette.accent} core={palette.accent} />
          OpenEyes
        </span>
        <span style={{ width: 22, height: 1, background: palette.accent, opacity: 0.6 }} />
        Verified Event
        <span style={{ color: palette.inkDim }}>· MPLS-0419</span>
      </div>

      {/* headline */}
      <h1
        style={{
          margin: "16px 0 0",
          fontFamily: FONT.serif,
          fontSize: 56,
          fontWeight: 500,
          lineHeight: 1.04,
          letterSpacing: "-0.015em",
          color: palette.ink,
          maxWidth: "19ch",
          ...blurInStyle(hl, 10, 14),
        }}
      >
        <span style={{ ...wipeStyle(reveal(frame, 18, 22)), display: "inline-block" }}>
          The killing of Alex&nbsp;Pretti, <em style={{ fontStyle: "italic", color: palette.accent }}>corroborated</em>.
        </span>
      </h1>

      {/* dateline */}
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 14, fontFamily: FONT.mono, fontSize: 14, letterSpacing: 0.5, color: palette.inkDim, opacity: dl }}>
        <span>MINNEAPOLIS · NICOLLET AVE</span>
        <Dot />
        <span>09:00 CDT</span>
        <Dot />
        <span style={{ color: palette.accent }}>{liveCount} of 5 angles live</span>
      </div>
    </div>
  );
};
