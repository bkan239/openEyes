import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { PERSPS } from "../lib/perspectives";
import { reveal, blurInStyle, outAt } from "../lib/anim";

const clip = PERSPS[0]; // M @marisol.vega — h264

/** 0–4s: one lone clip; the doubt stamp flips REAL? ⇄ FAKE?. */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = reveal(frame, 0, 12);
  const exit = outAt(frame, 100, 18);
  const exitShift = interpolate(frame, [100, 120], [0, -120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exitScale = interpolate(frame, [100, 120], [1, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // doubt stamp: flip every 9 frames between f18..f96
  const stampOn = frame >= 18 && frame <= 99;
  const idx = Math.floor((frame - 18) / 9);
  const isFake = idx % 2 === 1;
  const sinceFlip = (frame - 18) % 9;
  const punch = stampOn ? interpolate(sinceFlip, [0, 2, 9], [0.14, 0, 0], { extrapolateRight: "clamp" }) : 0;
  const flash = stampOn && sinceFlip < 2 ? 0.18 : 0;
  const jitter = stampOn ? ((frame * 37) % 5) - 2 : 0;

  const cardW = 352;
  const cardH = (cardW * 16) / 9;

  return (
    <AbsoluteFill style={{ background: palette.bg, alignItems: "center", justifyContent: "center" }}>
      {/* kicker */}
      <div style={{ position: "absolute", top: 360, fontFamily: FONT.mono, fontSize: 14, letterSpacing: 4, textTransform: "uppercase", color: palette.muted, opacity: reveal(frame, 6, 12) * exit }}>
        Unverified · Single source
      </div>

      {/* lone clip */}
      <div
        style={{
          position: "relative",
          width: cardW,
          height: cardH,
          borderRadius: 18,
          overflow: "hidden",
          border: `1px solid ${palette.glassStroke}`,
          boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)",
          opacity: enter * exit,
          transform: `translateX(${exitShift}px) rotate(-2deg) scale(${interpolate(enter, [0, 1], [0.96, 1]) * exitScale})`,
          filter: `saturate(0.85)`,
        }}
      >
        <OffthreadVideo src={staticFile(`clips/${clip.id}.mp4`)} muted startFrom={Math.round(clip.clipStartSec * 30)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: "rgba(22,19,16,0.18)" }} />
        {/* doubt stamp */}
        {stampOn && (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                fontFamily: FONT.serif,
                fontStyle: "italic",
                fontSize: 88,
                fontWeight: 600,
                color: isFake ? palette.danger : palette.victim,
                transform: `translateX(${jitter}px) scale(${1 + punch})`,
                textShadow: "0 6px 30px rgba(0,0,0,0.6)",
              }}
            >
              {isFake ? "FAKE?" : "REAL?"}
            </div>
          </AbsoluteFill>
        )}
        <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
      </div>

      {/* caption */}
      <div
        style={{
          position: "absolute",
          bottom: 250,
          fontFamily: FONT.sans,
          fontSize: 38,
          fontWeight: 600,
          color: palette.ink,
          ...blurInStyle(reveal(frame, 30, 14), 8, 14),
          opacity: reveal(frame, 30, 14) * exit,
        }}
      >
        A single clip can&apos;t prove itself.
      </div>
    </AbsoluteFill>
  );
};
