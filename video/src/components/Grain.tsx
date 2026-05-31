import React from "react";
import { AbsoluteFill } from "remotion";

/** Subtle film grain + warm vignette to unify the silent frames. */
export const Grain: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {/* vignette */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(120% 90% at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.28) 78%, rgba(0,0,0,0.5) 100%)",
        mixBlendMode: "multiply",
      }}
    />
    {/* grain */}
    <AbsoluteFill style={{ opacity: 0.06, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  </AbsoluteFill>
);
