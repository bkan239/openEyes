# Plan: 3D Reconstruction with VGGT-Omega (`services/recon3d`)

## Context

OpenEyes verifies real-world events by **corroboration** across many independent
recordings. The README lists *3D reconstruction* as the strongest corroboration
signal and the demo's "wow" closer: geometry that lines up across uncoordinated
sources is extremely hard to fake. It is currently unbuilt — the README and
`DEVELOPMENT.md` both reserve a home for it: *"3D reconstruction → not yet —
future `services/recon3d`"*.

This plan implements that service using **VGGT-Omega** (Meta/Oxford VGG,
CVPR 2026), a feed-forward multi-view model that infers camera poses + dense
depth and exports a GLB scene. Input is the **5 Minneapolis multi-angle clips**
already bundled in `angles/public/demo-clips/`. Output is a GLB scene asset that
either frontend can render.

### Key facts established during research
- **Model is gated** on HF ([`facebook/VGGT-Omega`](https://huggingface.co/facebook/VGGT-Omega)),
  license **CC-BY-NC-4.0** (non-commercial — fine for the hackathon). Request
  access on the model page (automated review, not instant).
- **Fallback while access is pending:** base [`facebook/VGGT-1B`](https://huggingface.co/facebook/VGGT-1B)
  (CVPR 2025) is ungated and has a nearly identical API + GLB-exporting gradio
  demo. Build against it first; swap the checkpoint to Omega once granted.
- **Requires an NVIDIA CUDA GPU** — will not run on the user's Mac, and the main
  API runs on AWS Lambda (no GPU). Reconstruction therefore runs separately on
  **RunPod** (user already has credit).
- VRAM is modest: ~6.7 GB / 10 frames, ~9.7 GB / 50, ~13 GB / 100 (A100
  benchmark). A single **RTX 4090 (24 GB)** is more than enough for our frame
  counts.
- Checkpoint to use: **VGGT-Omega-1B-512** (512px, geometry — not the
  text-alignment variant).

### Decisions (confirmed with user)
- **Build order:** offline precompute first (guaranteed demo asset); add a live
  RunPod endpoint only if time remains — both share one `core/` module.
- **Input:** the existing 5 Minneapolis clips.
- **Display:** output a frontend-agnostic GLB so either `angles/` (Vite) or
  `apps/web` (Next.js) can render it; pick the surface during integration.
- **Self-contained "project in the project":** teammates are actively working in
  `angles/`, `apps/web`, and `services/api`. `services/recon3d` must be fully
  isolated — its own copy of the clips, its own deps, its own standalone viewer —
  so this work neither depends on nor interferes with theirs. After a one-time
  clip copy, the pipeline reads **only** its own folder. Cross-folder wiring
  (rendering in a teammate's frontend) is optional and coordinated later.

## Design — one engine, two entry points

The flexibility is structural: `core/` does the real reconstruction and doesn't
care how it's invoked. `run.py` (offline) and `handler.py` (live) are thin
wrappers around it.

```
services/recon3d/                # self-contained: never reads sibling folders after setup
├── pyproject.toml          # uv project; torch+CUDA deps install on RunPod (Linux), not Mac
├── README.md               # how to run on a RunPod Pod
├── PLAN.md                  # a copy of this plan, for persistence
├── data/
│   └── clips/               # OWN copy of the 5 Minneapolis MP4s (copied once from angles/)
├── out/                     # generated scene.glb / scene.ply (gitignored or committed)
├── core/
│   ├── frames.py           # clips -> sampled, overlap-maximized frames (ffmpeg/decord)
│   ├── reconstruct.py      # load_and_preprocess_images -> VGGT(Omega) -> predictions
│   └── export.py           # depth-unproject + cameras -> scene.glb (+ optional .ply)
├── viewer/                  # tiny standalone GLB viewer (single HTML + <model-viewer>)
├── run.py                  # CLI: precompute the demo GLB once, write to out/
└── handler.py              # (phase 2, optional) RunPod serverless wrapper over core/
```

`reconstruct.py` mirrors the upstream inference path:
`VGGTOmega().eval()` → `model.load_state_dict(torch.load(ckpt))` →
`load_and_preprocess_images(frames, image_resolution=512)` →
`model(images)` under `torch.inference_mode()`. `export.py` follows the
repo's `demo_gradio.py` GLB export (depth-unprojected point cloud + predicted
cameras).

## Implementation steps

### Phase 0 — Scaffold, access & GPU (do first, in parallel)
1. Scaffold `services/recon3d/` and **copy the 5 clips** from
   `angles/public/demo-clips/*.mp4` into `services/recon3d/data/clips/` (a
   one-time read of the sibling folder; nothing is written there). Drop this
   plan at `services/recon3d/PLAN.md`. From here on the pipeline reads only
   `data/clips/`.
2. Request access to `facebook/VGGT-Omega` on HF (get an HF token ready).
3. Start a RunPod **Pod**: RTX 4090 (24 GB) or A40, PyTorch/CUDA template, with
   SSH + Jupyter. Clone this repo (or just `services/recon3d`) onto it.

### Phase 1 — Offline pipeline on the Pod (the guaranteed demo asset)
3. Create `services/recon3d/` as above (uv project; pin `torch` CUDA wheels).
   Install upstream: `pip install -e .` from the `vggt-omega` repo (or `vggt`
   for the fallback) plus `requirements.txt`.
4. `core/frames.py`: extract frames from the 5 clips in
   `services/recon3d/data/clips/`. Sample evenly per clip, optionally drop
   blurry frames; cap total frames (start ~40–80) to balance quality vs VRAM.
5. `core/reconstruct.py`: run inference with the **fallback `VGGT-1B`** first to
   prove the pipeline end-to-end; swap to **VGGT-Omega-1B-512** once access is
   granted (checkpoint path is a CLI arg).
6. `core/export.py`: export `out/scene.glb` (+ optional `scene.ply`).
7. `run.py`: wires 4→5→6 with args (`--clips-dir`, `--checkpoint`,
   `--max-frames`, `--out`). Run it, eyeball the GLB in a viewer.
8. Download `scene.glb` from the Pod, then **stop the Pod** to save credit.

### Phase 2 — Display (self-contained first, teammate frontends optional)
9. **Default (no friction):** render `out/scene.glb` in recon3d's own
   `viewer/` — a single static HTML page using the `<model-viewer>` web
   component. Fully demoable without touching any teammate folder.
10. **Optional cross-folder wiring (coordinate first):** expose the GLB to a
    teammate frontend. `angles/` is React 18 + Vite (Three.js / `@react-three/
    fiber` fits; see `angles/src/components/Map/`); `apps/web` is Next.js (event
    page at `apps/web/app/events/[id]/page.tsx`). Hand off the GLB (static asset
    or S3) rather than editing their code directly unless agreed.

### Phase 3 — Live endpoint (optional, only if time remains)
11. `handler.py`: RunPod **serverless** worker wrapping `core/` (takes clip URLs
    → returns GLB URL). `services/api` calls it on upload. Note cold-start /
    latency risk — keep the offline GLB as the demo fallback.

## Critical files
- **New:** everything under `services/recon3d/` (above) — including its own
  `data/clips/` copy of the MP4s.
- **Read once, at setup only:** `angles/public/demo-clips/*.mp4` (copied into
  `data/clips/`). Optionally `angles/src/data/pretti-clips.json` (per-frame
  GPS/heading) for sanity-checking poses — copy any needed slice locally.
- **Teammate folders:** untouched during dev. Any frontend wiring in Phase 2 is
  optional and coordinated; default is recon3d's own `viewer/`.

## Risks & mitigations
- **Gated weights slow to grant** → develop against ungated `VGGT-1B`; the
  checkpoint is a CLI arg, so swapping to Omega is a one-line change.
- **5 angles have limited mutual overlap** (different sides of the scene) →
  frame sampling tuned for overlap; if the multi-angle result is poor, fall back
  to frames from one moving clip for a clean guaranteed result, and still
  *attempt* the 5-angle version for the corroboration story.
- **CUDA deps won't install on the Mac** → expected; all heavy work runs on the
  Pod. Local repo only holds source + the resulting GLB.
- **Non-commercial license** → fine for the hackathon demo; flag before any
  commercial use.

## Verification
- **Pipeline:** `python run.py --clips-dir data/clips --checkpoint <ckpt>
  --out out/` on the Pod produces `out/scene.glb` without errors; frame count
  and peak VRAM print to log.
- **Geometry sanity:** open `scene.glb` in a viewer — predicted cameras should
  roughly ring the scene, consistent with the GPS headings in
  `pretti-clips.json`; the point cloud should show recognizable structure.
- **Viewer:** recon3d's standalone `viewer/` loads and renders `out/scene.glb`;
  orbit/zoom works; no console errors. (Any teammate-frontend wiring verified
  separately if/when done.)
- **(Phase 3)** POST clip URLs to the RunPod endpoint → returns a GLB URL that
  renders the same as the offline asset.
