import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { palette } from "../theme";
import { FONT } from "../lib/fonts";
import { MapBackdrop } from "../components/MapBackdrop";
import { MapOverlay } from "../components/MapOverlay";
import { Masthead } from "../components/Masthead";
import { AnglesList } from "../components/AnglesList";
import { Timeline } from "../components/Timeline";
import { VideoPanel } from "../components/VideoPanel";
import { PERSPS, VICTIM } from "../lib/perspectives";
import { project } from "../lib/geo";
import { reveal, blurInStyle, outAt } from "../lib/anim";

const FIRE = [30, 55, 80, 108, 140]; // cone reveal frames (M,D,R,A,J)
const v = project(VICTIM.xm, VICTIM.ym);

// Open the FIXED/VEHICLE cameras (dashcam + transit cam) as the enlarged panels:
// they frame the street, not people. The phone/bodycam still appear as pins,
// cones and list rows (the app lets you open any subset) but their footage is
// not enlarged. All panels are muted and show only the first ~1s (camera raise).
const PANELS = [
  { p: PERSPS[2], x: 980, y: 250, w: 252, at: 158 }, // R — dashcam (hero, clear street)
  { p: PERSPS[4], x: 1276, y: 446, w: 198, at: 182 }, // J — transit cam (fixed, distant)
  { p: PERSPS[0], x: 1014, y: 566, w: 198, at: 206 }, // M — iPhone (earliest, sidewalk approach)
];

/** 13.5–22.5s: the map lights up — five angles converge, panels sync, timeline scrubs. */
export const SceneAnglesHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const liveCount = FIRE.filter((f) => frame >= f).length;
  const mapScale = interpolate(frame, [0, 270], [1.05, 1.14]);

  const listT = reveal(frame, 70, 18);
  const tlT = reveal(frame, 104, 16);
  const playFrac = interpolate(frame, [104, 262], [0.34, 0.74], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const nowSec = Math.round(playFrac * 80);
  const nowLabel = `0:${String(nowSec).padStart(2, "0")}`;

  const cap = reveal(frame, 46, 14) * outAt(frame, 132, 12);

  return (
    <AbsoluteFill style={{ background: palette.mapVoid }}>
      {/* map + incident layer (push-in together) */}
      <AbsoluteFill style={{ transform: `scale(${mapScale})`, transformOrigin: `${v.x}px ${v.y}px` }}>
        <MapBackdrop />
        <MapOverlay frame={frame} fireFrames={FIRE} victimFrame={18} />
      </AbsoluteFill>

      {/* masthead */}
      <Masthead frame={frame} liveCount={liveCount} />

      {/* all angles list */}
      <AnglesList liveFlags={FIRE.map((f) => frame >= f)} entrance={listT} />

      {/* mid caption (clears before panels/timeline crowd in) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 250,
          textAlign: "center",
          fontFamily: FONT.serif,
          fontSize: 52,
          fontWeight: 500,
          color: palette.ink,
          ...blurInStyle(cap, 8, 14),
          opacity: cap,
        }}
      >
        Five strangers. One moment. <em style={{ fontStyle: "italic", color: palette.accent }}>Same truth.</em>
      </div>

      {/* floating synced panels */}
      {PANELS.map(({ p, x, y, w, at }) => {
        const s = spring({ frame: frame - at, fps, config: { damping: 18, mass: 0.6 } });
        if (s <= 0.001) return null;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              opacity: s,
              transform: `translateY(${(1 - s) * 36}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
              transformOrigin: "center top",
            }}
          >
            <VideoPanel p={p} width={w} />
          </div>
        );
      })}

      {/* timeline */}
      <Timeline playFrac={playFrac} nowLabel={nowLabel} entrance={tlT} />
    </AbsoluteFill>
  );
};
