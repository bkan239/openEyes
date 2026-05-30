// Palette ported from veriloc/ContentView.swift / map_style.json
// iOS app uses Color.black base with white at fixed opacities for chrome.
export const palette = {
  bg: "#000000",
  bgElevated: "#0c0c0e",
  bgChip: "rgba(255,255,255,0.08)",
  bgChipStrong: "rgba(255,255,255,0.15)",
  glassFill: "rgba(255,255,255,0.05)",
  glassStroke: "rgba(255,255,255,0.10)",
  hairline: "rgba(255,255,255,0.07)",
  divider: "rgba(255,255,255,0.06)",

  text: "#ffffff",
  textDim: "rgba(255,255,255,0.72)",
  textFaint: "rgba(255,255,255,0.45)",
  textGhost: "rgba(255,255,255,0.30)",

  accent: "#ffffff", // iOS uses pure white for primary CTA fills
  accentInk: "#000000", // text on accent fills

  // Map style colors (lifted from veriloc/map_style.json)
  mapBase: "#0a1326",
  mapWater: "#0a1f3a",
  mapLand: "#0d1a2e",
  mapPark: "#0a2433",
  mapRoadMinor: "#1a2a4a",
  mapRoadArterial: "#26385c",
  mapRoadHighway: "#3b5078",
  mapBuilding: "#142340",
  mapAdminStroke: "#33476b",
  mapTextFill: "#7a93b3",
  mapTextStroke: "#0a1326",

  // Story / category gradients (StoryService.swift)
  gradients: {
    conflict: ["#451015", "#b53b17"],
    politics: ["#0f1f47", "#127aa6"],
    world: ["#142639", "#1f6694"],
    nature: ["#142e23", "#528739"],
    misc: ["#33333d", "#155777"]
  },

  // semantic
  upvote: "#ffffff",
  cone: "#fef08a", // soft gold for heading cones, like iOS Mock Studio
  liveDot: "#ff3b30"
} as const;

export const radii = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const spacing = (n: number) => `${n * 4}px`;
export const font = {
  family: '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  weightRegular: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700
} as const;
