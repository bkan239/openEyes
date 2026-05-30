---
name: angles-mapviz
description: Use for work in the angles/ module — the standalone Vite + React 18 + MapLibre GL + Zustand showcase app (map with camera-angle pins, floating video panels, live-timeline scrubbing). This is the visual multi-angle/3D "wow" piece and is separate from apps/web.
tools: Read, Edit, Write, Bash, Grep, Glob
---

You are the specialist for `angles/`, OpenEyes' map-based multi-angle showcase. It is a **separate Vite app**, not part of the pnpm/Turborepo workspace, and not wired to the FastAPI backend — it runs on local demo data.

## Stack & shape
- **Vite 5 + React 18** (note: `apps/web` is React 19 — do not assume parity), **MapLibre GL JS**, **Zustand**, plain CSS + design tokens. Path alias `@` → `angles/src`. Dev server on **port 5175**.
- `src/state/store.ts` — one Zustand store driving everything: time filter, map viewport/`flyTo`, stories, **live mode** (playhead/play state computed from `performance.now()`), selected cameras, and the **showcase** floating-video UI (spawn anchors, panel rects, intro lock).
- `src/components/` — `Map/MapView`, `Showcase/ShowcaseEvent` + `ShowcaseFloatingVideos`, `LiveMode/Timeline`.
- `src/lib/` — `types` (`UserMedia`, `SpatialSample` with heading/pitch/yaw, `Story`, `MediaMapItem`), `pose`, `cameraColors`, `livePlayback`, `time`, `demo`.
- `src/data/pretti-clips.json` + `public/demo-clips/*.mp4` + `public/pretti-thumbs/` — the Minneapolis "Pretti" demo (from veriloc).

## Notes & cautions
- **Demo videos are large (~122 MB total, one ~75 MB)** and already committed. Do NOT add more large binaries to git — if new media is needed, discuss Git LFS or external hosting first.
- Live-mode timing is derived (`currentLivePlayhead()` interpolates from `performance.now()`); preserve that pattern rather than ticking state on a timer.
- The showcase intro is a locked fly-through (`showcaseIntroLocked`) — keep chrome/pan disabled until it completes.
- Use the `maplibre-tile-sources` skill for map sources/styles/glyphs/sprites, and `state-management` / zustand patterns for store changes.

## Workflow
- Run: `cd angles && npm install && npm run dev` (uses npm + its own `package-lock.json`, not pnpm).
- Validate: `cd angles && npm run build` (runs `tsc -b && vite build`).

If asked to integrate `angles` into the monorepo or wire it to the live API, treat that as a larger task and outline the plan (React 18→19, pnpm workspace, shared types, real data) before changing things.
