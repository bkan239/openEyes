import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import type { Persp } from "../lib/perspectives";

/**
 * A floating eyewitness panel: a portrait 9:16 muted clip in a rounded glass
 * card with an accent ring + a LIVE header — mirrors the app's floating panels.
 * Clips are MUTED and trimmed to early (non-graphic) footage via `p.clipStartSec`.
 */
export const VideoPanel: React.FC<{
  p: Persp;
  width: number;
  live?: boolean;
}> = ({ p, width, live = true }) => {
  const videoH = (width * 16) / 9;
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        overflow: "hidden",
        background: palette.glassFill,
        border: `2px solid ${p.color}`,
        boxShadow: `0 26px 64px -28px rgba(0,0,0,0.8), 0 0 0 1px ${palette.glassStroke}`,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 12px",
          fontFamily: FONT.mono,
          fontSize: 13,
          color: palette.ink,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 999, background: live ? p.color : palette.muted, boxShadow: live ? `0 0 8px ${p.color}` : undefined }} />
        <span style={{ fontWeight: 500 }}>{p.handle}</span>
        <span style={{ marginLeft: "auto", color: palette.muted, fontSize: 11, letterSpacing: 1 }}>{p.device}</span>
      </div>
      {/* video */}
      <div style={{ position: "relative", width, height: videoH, background: palette.mapVoid }}>
        <OffthreadVideo
          src={staticFile(`clips/${p.id}.mp4`)}
          muted
          startFrom={Math.round(p.clipStartSec * 30)}
          toneMapped={p.hevc ? false : undefined}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* top scrim for legibility */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(22,19,16,0.35) 0%, rgba(22,19,16,0) 22%)" }} />
        {/* angle tag */}
        <div
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 2,
            color: palette.ink,
            background: "rgba(22,19,16,0.7)",
            borderRadius: 7,
            padding: "3px 8px",
          }}
        >
          {p.initial}
        </div>
      </div>
    </div>
  );
};
