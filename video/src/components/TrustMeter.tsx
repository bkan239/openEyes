import React from "react";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";

/**
 * The explainable trust block — mirrors .ev-trust in the live app.
 * Big serif number (tabular), label, 5 corroboration bars, and the checklist sub.
 */
export const TrustMeter: React.FC<{
  value: number;
  barProgress: number[]; // 0..1 per bar
  subT?: number; // 0..1 reveal of the sub line
  numScale?: number;
}> = ({ value, barProgress, subT = 1, numScale = 1 }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 20px",
        border: `1px solid ${palette.glassStroke}`,
        borderRadius: 16,
        background: "rgba(38,36,31,0.6)",
      }}
    >
      <div
        style={{
          fontFamily: FONT.serif,
          fontWeight: 500,
          fontSize: 56 * numScale,
          lineHeight: 1,
          color: palette.accent,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toFixed(2)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: palette.muted }}>
          Trust index · corroboration
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {barProgress.map((b, i) => (
            <div key={i} style={{ width: 30, height: 6, borderRadius: 2, background: palette.hairline, overflow: "hidden" }}>
              <div style={{ width: `${b * 100}%`, height: "100%", background: palette.accent }} />
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 14, color: palette.inkDim, opacity: subT }}>
          5 independent sources · audio-synced · no tampering
        </div>
      </div>
    </div>
  );
};
