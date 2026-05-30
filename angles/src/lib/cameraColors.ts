// Cool blues → rosés: same id always maps to the same accent (timeline, map pins, floating panels).

const TRACK_COLORS = [
  "#b8e3ff",
  "#355a7a",
  "#5eb0f0",
  "#3d8fda",
  "#2f6fb8",
  "#1f558f",
  "#143d68",
  "#ff375f",
  "#ff6b92",
  "#e84393",
  "#c2185b",
  "#ffb7c5"
] as const;

export function cameraAccentColor(mediaId: string): string {
  let h = 0;
  for (const ch of mediaId) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return TRACK_COLORS[h % TRACK_COLORS.length];
}
