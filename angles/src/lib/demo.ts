// Minneapolis (Pretti) demo — static eyewitness clips bundled in public/.
import type { Story, UserMedia } from "./types";
import prettiClips from "@/data/pretti-clips.json";

export const PRETTI_STORY_ID = "demo-pretti-minneapolis";

export const PRETTI_CENTER: [number, number] = [-93.27777, 44.955];
export const PRETTI_EVENT_TIME = "2026-01-24T08:00:00Z";

/** minLon, minLat, maxLon, maxLat from first trajectory sample or static lat/lon */
export function prettiItemsBounds(items: UserMedia[]): [number, number, number, number] | null {
  if (!items.length) return null;
  const lats = items.map((m) => m.samples?.[0]?.lat ?? m.lat);
  const lons = items.map((m) => m.samples?.[0]?.lon ?? m.lon);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export const prettiStory: Story = {
  id: PRETTI_STORY_ID,
  title: "Killing of Alex Pretti — ICE fatally shoots ICU nurse in Minneapolis",
  summary:
    "Eyewitness mobile-captured footage of an ICE enforcement action that escalated into a fatal shooting near 26th & Nicollet, Minneapolis. Five on-the-ground GroundTruth captures with verified GPS, time, and heading.",
  category: "demo",
  location: "Minneapolis, MN",
  event_lat: PRETTI_CENTER[1],
  event_lon: PRETTI_CENTER[0],
  event_time: PRETTI_EVENT_TIME,
  importance_score: 999,
  article_count: 8,
  media_count: 5,
  source_icons: [
    "https://www.google.com/s2/favicons?domain=reuters.com&sz=64",
    "https://www.google.com/s2/favicons?domain=bbc.co.uk&sz=64",
    "https://www.google.com/s2/favicons?domain=nytimes.com&sz=64",
    "https://www.google.com/s2/favicons?domain=apnews.com&sz=64",
    "https://www.google.com/s2/favicons?domain=cnn.com&sz=64",
    "https://www.google.com/s2/favicons?domain=theguardian.com&sz=64",
    "https://www.google.com/s2/favicons?domain=nbcnews.com&sz=64",
    "https://www.google.com/s2/favicons?domain=mprnews.org&sz=64"
  ]
};

const STATIC_CLIPS = prettiClips as unknown as UserMedia[];

/** Demo: drop clip labeled "Cam 1d6171" (UUID compact prefix `1d6171`). */
export function isMockExcludedMediaId(id: string): boolean {
  const compact = id.toLowerCase().replace(/-/g, "");
  return compact.startsWith("1d6171");
}

/** Real thumbnail URL only — demo/mock clips omit synthetic photos (glyph / empty state instead). */
export function mapPinThumbnailUrl(thumbnailUrl: string | null | undefined): string {
  const t = thumbnailUrl?.trim();
  if (t && t !== "null" && t !== "undefined") return t;
  return "";
}

export async function loadPrettiMedia(): Promise<UserMedia[]> {
  return STATIC_CLIPS.filter((m) => !isMockExcludedMediaId(m.id));
}
