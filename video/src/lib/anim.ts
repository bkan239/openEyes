import type { CSSProperties } from "react";
import { interpolate } from "remotion";
import { EASE } from "../theme";

/** 0→1 eased ramp between [delay, delay+dur]. */
export function reveal(frame: number, delay: number, dur = 14): number {
  return interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
}

/** Serif-headline entrance: blur + rise + fade, driven by a 0→1 t. */
export function blurInStyle(t: number, blurPx = 12, ty = 16): CSSProperties {
  return {
    opacity: t,
    filter: `blur(${(1 - t) * blurPx}px)`,
    transform: `translateY(${(1 - t) * ty}px)`,
  };
}

/** Hard mono "type-on" — clamp a width fraction for clip-path mask wipes. */
export function wipeStyle(t: number): CSSProperties {
  return { clipPath: `inset(0 ${(1 - t) * 100}% 0 0)` };
}

/** A short "thock" punch: 0 outside the window, a quick scale blip at `at`. */
export function punch(frame: number, at: number, amount = 0.06, dur = 8): number {
  const p = interpolate(frame, [at, at + dur / 2, at + dur], [0, amount, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return 1 + p;
}

/** Caption fade-out near the end of a scene window. */
export function outAt(frame: number, at: number, dur = 10): number {
  return interpolate(frame, [at, at + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
