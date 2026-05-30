// Editorial Ink — warm near-black stage with a single petrol/teal brand accent.
// Mirrors Openeyes_Angles_Design/styles.css so the showcase reads as one design.
export const palette = {
  bg: "#1C1B19",
  bgElevated: "#221F1B",
  bgChip: "rgba(252,251,248,0.06)",
  bgChipStrong: "rgba(252,251,248,0.12)",
  glassFill: "rgba(38,36,31,0.86)",
  glassStroke: "rgba(252,251,248,0.11)",
  hairline: "rgba(252,251,248,0.08)",
  divider: "rgba(252,251,248,0.06)",

  text: "#FCFBF8",
  textDim: "rgba(252,251,248,0.66)",
  textFaint: "rgba(252,251,248,0.42)",
  textGhost: "rgba(252,251,248,0.28)",

  accent: "#6FBDB0", // petrol/teal that glows on ink
  accentDeep: "#2f8f83",
  accentInk: "#161310", // text on accent fills

  // Single-hue teal ramp — five "unified, not rainbow" perspective shades.
  perspectiveRamp: ["#bfe6df", "#97d3c8", "#6FBDB0", "#52a597", "#3f8a7d"],

  // Map style colors (warm-ink stylization of the dark base)
  mapVoid: "#161310",
  mapBlock: "#221F1B",
  mapBlock2: "#1E1B17",
  mapStreet: "#2b2722",
  mapStreetMajor: "#36302a",
  mapLane: "#4a443c",
  mapTextFill: "#847d70",
  mapTextStroke: "#161310",

  // Story / category gradients (StoryService.swift) — kept for product mode
  gradients: {
    conflict: ["#451015", "#b53b17"],
    politics: ["#0f1f47", "#127aa6"],
    world: ["#142639", "#1f6694"],
    nature: ["#142e23", "#528739"],
    misc: ["#33333d", "#155777"]
  },

  // semantic
  upvote: "#FCFBF8",
  victim: "#F4EFD9", // warm subject highlight
  cone: "#6FBDB0",
  liveDot: "#6FBDB0"
} as const;

export const radii = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const spacing = (n: number) => `${n * 4}px`;
export const font = {
  family: '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: '"Newsreader", Georgia, serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  weightRegular: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700
} as const;
