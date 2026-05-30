// Single petrol/teal hue (a subtle shade ramp, not a rainbow): the same id
// always maps to the same shade across timeline, map cones/dots, and panels.
// The curated five Pretti perspectives + their ordering live in perspectives.ts.
import { perspectiveColor } from "./perspectives";

export function cameraAccentColor(mediaId: string): string {
  return perspectiveColor(mediaId);
}
