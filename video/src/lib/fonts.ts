import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadHanken } from "@remotion/google-fonts/HankenGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

// Load full families (incl. Newsreader italic, Hanken 400–800, Plex 400/500).
// Remotion blocks the render via delayRender until these resolve — no FOUT.
const newsreader = loadNewsreader();
const hanken = loadHanken();
const mono = loadMono();

export const FONT = {
  serif: newsreader.fontFamily, // Newsreader — headlines, italic emphasis in teal
  sans: hanken.fontFamily, // Hanken Grotesk — captions / body / wordmark
  mono: mono.fontFamily, // IBM Plex Mono — kickers, datelines, data
};

export const waitForFonts = () =>
  Promise.all([
    newsreader.waitUntilDone(),
    hanken.waitUntilDone(),
    mono.waitUntilDone(),
  ]);
