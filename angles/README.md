# Angles

**Minneapolis eyewitness demo — five angles, one event.**

A self-contained frontend demo of the veriloc `/demo` showcase: five independent phone captures of the same incident at 26th & Nicollet, Minneapolis, presented on a map with a shared timeline and floating video panels.

No backend required. All clips, thumbnails, and GPS trajectories are bundled in this folder.

---

## What you get

- **Cinematic map intro** — wide establishing shot, then fly-in to the incident
- **Clip-gated map markers** — heading cones appear only while each angle is active on the timeline
- **Shared timeline** — scrub or play through all five clips in wall-clock order
- **Floating video panels** — click a marker to open a draggable, resizable 9:16 clip; press Esc to close

This is the Minnesota (Pretti) demo from veriloc, stripped to only what the showcase needs.

---

## Quick start

```bash
cd angles
npm install
npm run dev
```

Open [http://localhost:5175](http://localhost:5175).

Production build:

```bash
npm run build
npm run preview
```

---

## What's bundled

| Asset | Location |
| --- | --- |
| 5 eyewitness MP4s | `public/demo-clips/` |
| Map pin thumbnails | `public/pretti-thumbs/` |
| Clip metadata + GPS samples | `src/data/pretti-clips.json` |

Clip metadata includes per-frame GPS, heading, and timestamps (5 Hz trajectories) so map cones and video sync match the original demo.

---

## Project structure

```
angles/
├── public/
│   ├── demo-clips/          # eyewitness MP4s (local file_url targets)
│   └── pretti-thumbs/       # JPEG thumbnails for map pins
├── src/
│   ├── components/
│   │   ├── Showcase/        # main demo shell + floating videos
│   │   ├── Map/             # MapLibre map, live cones, pin clicks
│   │   └── LiveMode/        # bottom timeline scrubber
│   ├── data/
│   │   └── pretti-clips.json
│   ├── lib/                 # demo data, playback math, pose interpolation
│   └── state/               # Zustand store (timeline, panels, map)
├── index.html
├── package.json
└── vite.config.ts
```

---

## Tech stack

- **React 18** + **TypeScript**
- **Vite** — dev server and build
- **MapLibre GL** — dark map (OpenFreeMap tiles, no API key)
- **Zustand** — shared state for timeline, map, and floating panels

---

## Differences from veriloc webapp

| veriloc webapp | angles |
| --- | --- |
| Fetches clips from GroundTruth API | Static JSON + local MP4s |
| Vercel API proxy for CORS/HTTPS | Not needed |
| Full product UI (sidebar, stories, search) | Showcase only |
| `/demo` route via react-router | Single-page app |

---

## Notes

- **Five active angles** — one mock clip (`1d6171`) is excluded, same as veriloc.
- **Video size** — the bundled MP4s are ~120 MB total; they're committed for a fully offline demo. Consider Git LFS if the repo grows.
- **Map tiles** — loaded from OpenFreeMap at runtime; an internet connection is required for the basemap only.
