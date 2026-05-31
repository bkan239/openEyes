# OpenEyes — promo video (Remotion)

A ~35-second, 1920×1080, **silent** promo for OpenEyes, built with
[Remotion](https://remotion.dev) so it's reproducible and code-owned. It recreates
the `angles` "Editorial Ink" UI pixel-faithfully, embeds the five real eyewitness
demo clips as the synced floating panels, and orbits the **real 3D reconstruction**
(`services/recon3d/viewer/scene.glb`, a 600k-point colored cloud).

Rendered output lives at [`../media/openeyes-demo.mp4`](../media/openeyes-demo.mp4)
(+ poster `../media/openeyes-poster.png`).

## Develop

```bash
cd video
npm install
npm run studio      # open Remotion Studio, scrub the timeline
```

## Render

```bash
npm run render      # → out/openeyes-demo.mp4 (h264, crf 26, --gl angle for the 3D scene)
# strip the placeholder silent audio track → genuinely audio-free deliverable:
ffmpeg -y -i out/openeyes-demo.mp4 -c:v copy -an ../media/openeyes-demo.mp4
# poster frame (extracted from the render; frame 560 ≈ 18.67s):
ffmpeg -y -ss 18.6667 -i out/openeyes-demo.mp4 -frames:v 1 ../media/openeyes-poster.png
# README GIF (denoised, palette-optimised):
ffmpeg -y -i ../media/openeyes-demo.mp4 -vf "fps=11,scale=760:-1:flags=lanczos,hqdn3d=4:3:6:6,palettegen=stats_mode=diff" /tmp/pal.png
ffmpeg -y -i ../media/openeyes-demo.mp4 -i /tmp/pal.png -lavfi "fps=11,scale=760:-1:flags=lanczos,hqdn3d=4:3:6:6[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2" ../media/openeyes-demo.gif
```

## Story (seven scenes, 1051 frames @ 30fps ≈ 35s)

| s | scene | beat |
| --- | --- | --- |
| 0–4 | Hook | one lone clip flips `REAL?` ⇄ `FAKE?` — "A single clip can't prove itself." |
| 4–8 | Problem | a cold scatter of unverifiable footage — "a lie spreads… real footage gets called fake." |
| 8–13.5 | Corroboration | one point splits into five converging angles — "Five that line up are *proof*." |
| 13.5–20.5 | **Angles hero** | the real Minneapolis map: pins drop, view-cones lock on `A. PRETTI`, the ALL ANGLES panel + synced clip panels + scrubbing timeline. |
| 20.5–26 | **3D reconstruction** | the real `scene.glb` point cloud orbits — "Geometry that *can't be faked*. 600,000 points · 5 angles · no COLMAP." |
| 26–31 | Trust | the explainable score counts up `0.54 → 0.96`. |
| 31–35 | Outro | the aperture iris opens · `openeyes` · "One witness can lie. *Five cannot.*" |

## How it's built

- **One 1051-frame composition** (`src/Root.tsx` → `src/OpenEyesPromo.tsx`),
  scenes stitched with `@remotion/transitions`.
- **The 3D scene** (`src/scenes/SceneRecon3D.tsx`) loads the real `scene.glb`
  via `@remotion/three` + three.js and orbits the colored point cloud. Headless
  Chromium needs the ANGLE GL backend, so render with `--gl angle`
  (`remotion.config.ts` also sets `setChromiumOpenGlRenderer("angle")`).
  The GLB is copied into `public/` automatically by the `assets` script (a
  `pre*` hook on studio/render/still) from its canonical location
  `services/recon3d/viewer/scene.glb` — so it is **not** duplicated in git.
- **Design tokens** (`src/theme.ts`) copied from `angles/src/styles/global.css`
  — same warm-ink palette, single teal accent, cream subject highlight.
- **Fonts** (`src/lib/fonts.ts`) load Newsreader / Hanken Grotesk / IBM Plex Mono
  via `@remotion/google-fonts` (self-hosted at render time, no FOUT).
- **The real clips** stream from `public/clips` (a symlink to
  `angles/public/demo-clips`, so no large binaries are duplicated). They are
  **muted** and trimmed to the first ~1–3s (camera-raise / street); the enlarged
  panels use only the fixed dashcam + transit cam + phone — the bodycam appears
  as a pin/cone but its footage is never shown.
- Camera positions, headings, handles, devices and the teal ramp in
  `src/lib/perspectives.ts` mirror the live app's real capture metadata.

## Notes

- Silent by design — captions carry the narrative; every embedded clip is muted
  and the committed `.mp4` has **no audio stream**.
- `node_modules/` and `out/` are gitignored; the committed deliverables are the
  `.mp4` + poster under `../media/`.
