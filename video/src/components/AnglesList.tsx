import React from "react";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { GlassPanel } from "./GlassPanel";
import { PERSPS } from "../lib/perspectives";

/** The ALL ANGLES panel — mirrors AnglesPanel.tsx (top-right list of perspectives). */
export const AnglesList: React.FC<{
  liveFlags: boolean[];
  entrance?: number;
}> = ({ liveFlags, entrance = 1 }) => {
  const liveCount = liveFlags.filter(Boolean).length;
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        right: 44,
        width: 360,
        opacity: entrance,
        transform: `translateX(${(1 - entrance) * 40}px)`,
      }}
    >
      <GlassPanel radius={18}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 18px 14px", borderBottom: `1px solid ${palette.hairline}` }}>
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: palette.muted, fontWeight: 600 }}>All angles</div>
            <div style={{ fontFamily: FONT.serif, fontSize: 20, color: palette.ink, marginTop: 4 }}>5 perspectives</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
          {PERSPS.map((p, i) => {
            const live = liveFlags[i];
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "11px 12px",
                  borderRadius: 13,
                  background: live ? "rgba(252,251,248,0.055)" : "rgba(252,251,248,0.02)",
                  border: `1px solid ${live ? palette.glassStroke : "transparent"}`,
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 999, background: p.color, color: palette.accentInk, fontFamily: FONT.mono, fontWeight: 700, fontSize: 13, display: "grid", placeItems: "center" }}>{p.initial}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT.mono, fontSize: 13.5, color: palette.ink }}>{p.handle}</span>
                  <span style={{ display: "block", fontFamily: FONT.sans, fontSize: 11.5, color: palette.muted, marginTop: 1 }}>{p.device}</span>
                </span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.5, fontWeight: 600, color: live ? palette.accent : palette.muted }}>
                  {live ? "● LIVE" : "WAITING"}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 18px", borderTop: `1px solid ${palette.hairline}`, fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: 2, textTransform: "uppercase", color: palette.muted }}>
          <span>Synced to timeline</span>
          <span style={{ color: palette.inkDim }}>{liveCount} live</span>
        </div>
      </GlassPanel>
    </div>
  );
};
