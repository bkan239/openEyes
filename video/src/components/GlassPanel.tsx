import React from "react";
import { palette } from "../theme";

/**
 * Glass panel — a SOLID semi-opaque fill (not a real backdrop-filter, which is
 * unreliable in Remotion's headless Chromium). On the near-black stage it reads
 * as the same frosted glass the live app uses.
 */
export const GlassPanel: React.FC<{
  style?: React.CSSProperties;
  children?: React.ReactNode;
  radius?: number;
}> = ({ style, children, radius = 18 }) => (
  <div
    style={{
      background: palette.glassFill,
      border: `1px solid ${palette.glassStroke}`,
      borderRadius: radius,
      boxShadow: "0 24px 60px -30px rgba(0,0,0,0.85)",
      ...style,
    }}
  >
    {children}
  </div>
);
