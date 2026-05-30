import React from "react";
import { FONT } from "../lib/fonts";
import { palette } from "../theme";

/** "openeyes" wordmark — light "open" + bold "eyes", matching the brand lockup. */
export const Wordmark: React.FC<{ size?: number; color?: string }> = ({ size = 64, color = palette.ink }) => (
  <span style={{ fontFamily: FONT.sans, fontSize: size, letterSpacing: "-0.03em", color, lineHeight: 1, whiteSpace: "nowrap" }}>
    <span style={{ fontWeight: 400, opacity: 0.8 }}>open</span>
    <span style={{ fontWeight: 800 }}>eyes</span>
  </span>
);
