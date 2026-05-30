import type { ShowcasePanelRect } from "@/state/store";

const CHROME_TOP_PX = 12;
const COLLIDE_STEP = 24;

/** Horizontal padding baked into outer width (ring 2 + 2) */
export const SHOWCASE_PANEL_HORIZONTAL_INSET = 4;

/** Total outer height: accent ring + portrait video area (controls float on video). */
export function showcasePanelOuterHeight(totalWidth: number): number {
  const innerW = Math.max(0, totalWidth - SHOWCASE_PANEL_HORIZONTAL_INSET);
  const videoH = innerW * (16 / 9);
  return videoH + 4;
}

/** Portrait panel: width drives outer height */
export function defaultPanelWidthPx(viewportW: number): number {
  return Math.round(Math.min(340, Math.max(200, Math.min(viewportW * 0.28, 380))));
}

export function panelHeightPx(width: number): number {
  return showcasePanelOuterHeight(width);
}

export function rectsOverlap(a: ShowcasePanelRect, b: ShowcasePanelRect, pad = 8): boolean {
  return (
    a.left + a.width + pad > b.left &&
    b.left + b.width + pad > a.left &&
    a.top + a.height + pad > b.top &&
    b.top + b.height + pad > a.top
  );
}

/**
 * Prefer placing the panel away from the pin toward the farther viewport quadrant,
 * within the playable map area (HUD stack order handles overlap with timeline).
 */
export function computeSpawnRect(args: {
  viewportW: number;
  viewportH: number;
  panelW: number;
  panelH: number;
  /** Map container pixel coords of clicked pin */
  pin: { x: number; y: number } | null;
  existing: ShowcasePanelRect[];
}): ShowcasePanelRect {
  const margin = 14;
  const maxTop = Math.max(margin + CHROME_TOP_PX, args.viewportH - args.panelH - margin);
  const maxLeft = Math.max(margin, args.viewportW - args.panelW - margin);

  let left: number;
  let top: number;

  const midX = args.viewportW / 2;
  const midY = args.viewportH / 2;

  if (args.pin) {
    const pinLeft = args.pin.x < midX;
    const pinAbove = args.pin.y < midY;
    if (pinLeft) {
      left = Math.min(args.pin.x + 42, maxLeft);
    } else {
      left = Math.max(margin, args.pin.x - args.panelW - 42);
    }
    left = Math.min(Math.max(margin, left), maxLeft);
    if (pinAbove) {
      top = Math.min(args.pin.y + 28, maxTop);
    } else {
      top = Math.max(margin + CHROME_TOP_PX, args.pin.y - args.panelH - 28);
    }
    top = Math.min(Math.max(margin + CHROME_TOP_PX, top), maxTop);
  } else {
    left = maxLeft;
    top = margin + CHROME_TOP_PX;
  }

  let rect: ShowcasePanelRect = { left, top, width: args.panelW, height: args.panelH };

  let guard = 0;
  while (guard++ < 40 && args.existing.some((er) => rectsOverlap(rect, er))) {
    rect = {
      ...rect,
      left: Math.min(maxLeft, rect.left + COLLIDE_STEP),
      top: Math.min(maxTop, rect.top + COLLIDE_STEP)
    };
    if (rect.left >= maxLeft && rect.top >= maxTop) {
      rect = { ...rect, left: margin, top: margin + CHROME_TOP_PX };
      break;
    }
  }

  return rect;
}
