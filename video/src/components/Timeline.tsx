import React from "react";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { GlassPanel } from "./GlassPanel";
import { PERSPS, WINDOW_SEC } from "../lib/perspectives";

/** Editorial scrubbable timeline — mirrors .ev-timeline. `playFrac` 0..1. */
export const Timeline: React.FC<{
  playFrac: number;
  nowLabel: string;
  entrance?: number; // 0..1
}> = ({ playFrac, nowLabel, entrance = 1 }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 120,
        right: 430,
        bottom: 34,
        opacity: entrance,
        transform: `translateY(${(1 - entrance) * 26}px)`,
      }}
    >
      <GlassPanel radius={20} style={{ padding: "16px 24px 16px" }}>
        {/* head */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 13, color: palette.muted, letterSpacing: 1 }}>09:00 AM</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 15, color: palette.ink, fontWeight: 600, letterSpacing: 1 }}>{nowLabel}</span>
          <span style={{ fontFamily: FONT.mono, fontSize: 13, color: palette.muted, letterSpacing: 1 }}>09:02 AM</span>
        </div>
        {/* body: play + lanes */}
        <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, fontFamily: FONT.mono, fontSize: 11, fontWeight: 700, color: palette.inkDim }}>
            {PERSPS.map((p) => (
              <span key={p.id} style={{ height: 16, display: "flex", alignItems: "center", color: p.color }}>{p.initial}</span>
            ))}
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            {PERSPS.map((p) => {
              const left = (p.onlineSec / WINDOW_SEC) * 100;
              const width = (Math.min(p.durSec, WINDOW_SEC - p.onlineSec) / WINDOW_SEC) * 100;
              return (
                <div key={p.id} style={{ position: "relative", height: 16, margin: "1px 0" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "rgba(252,251,248,0.05)" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, borderRadius: 999, background: p.color, opacity: 0.85 }} />
                </div>
              );
            })}
            {/* playhead */}
            <div style={{ position: "absolute", top: -8, bottom: -8, left: `${playFrac * 100}%`, width: 2, background: palette.ink, boxShadow: "0 0 10px rgba(0,0,0,0.6)" }}>
              <div style={{ position: "absolute", bottom: -7, left: -7, width: 14, height: 14, borderRadius: 999, background: palette.ink, boxShadow: "0 2px 10px rgba(0,0,0,0.6)" }} />
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
};
