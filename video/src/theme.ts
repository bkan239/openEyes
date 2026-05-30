import { Easing } from "remotion";

/**
 * Editorial Ink — copied verbatim from the live angles app
 * (angles/src/styles/global.css). Warm near-black stage, single petrol/teal
 * accent, cream subject highlight. The whole film stays inside this system.
 */
export const palette = {
  bg: "#1c1b19",
  bgElevated: "#221f1b",
  mapVoid: "#161310",
  mapBlock: "#221f1b",
  mapStreet: "#2b2722",
  mapStreetMajor: "#383229",
  glassFill: "rgba(38,36,31,0.92)", // slightly more opaque than the app — headless Chromium can't blur backdrops
  glassStroke: "rgba(252,251,248,0.11)",
  hairline: "rgba(252,251,248,0.08)",
  ink: "#fcfbf8",
  inkDim: "#a8a296",
  textDim: "rgba(252,251,248,0.66)",
  textFaint: "rgba(252,251,248,0.42)",
  muted: "#847d70",
  accent: "#6fbdb0",
  accentDeep: "#2f8f83",
  accentInk: "#161310",
  victim: "#f4efd9",
  // The single low-chroma warm "danger" tone — used ONLY for the FAKE? doubt stamp.
  danger: "#c2645a",
};

/** Single-hue teal ramp (light → deep), one shade per perspective A..E. */
export const ramp = ["#bfe6df", "#97d3c8", "#6FBDB0", "#52a597", "#3f8a7d"];

/** The app's entrance curve. Documentary, not bouncy. */
export const EASE = Easing.bezier(0.22, 1, 0.32, 1);
export const EASE_OUT = Easing.out(Easing.cubic);
