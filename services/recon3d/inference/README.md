# inference/ — AnySplat live pipeline (feed-forward, seconds)

The **fast / live** path: a folder of photos → 3D Gaussians + camera poses in
**one forward pass** → rendered fly-through, in seconds. No per-scene training.

Uses **[AnySplat](https://github.com/InternRobotics/AnySplat)** (SIGGRAPH Asia 2025,
MIT, VGGT-backbone, pose-free / uncalibrated / any number of views) — ideal for
audience-uploaded photos.

> **Isolated on purpose.** This folder has its **own `uv` venv** (`.venv-anysplat`,
> Python 3.10 + torch 2.2/cu121). It does **not** touch the working recon3d env
> (VGGT-Omega + nerfstudio on torch 2.4.1/cu124). The optimization pipeline in
> `../` is left fully intact for comparison.

## Setup (once, on the RunPod pod)
```bash
bash services/recon3d/inference/setup.sh
```
Clones AnySplat, builds the isolated venv, installs deps, prints a CUDA check.

## Run

**One-shot (test / A-B vs the optimization pipeline):**
```bash
cd services/recon3d/inference
source .venv-anysplat/bin/activate
python run_once.py --images-dir ../data/easy_data/pics --out outputs/room
# compare outputs/room/*.mp4  vs  ../roomtest/flythrough.mp4 (Splatfacto)
```

**Warm server (the live demo):**
```bash
python serve.py
# drop photos into inference/uploads/ (drag in VS Code / AirDrop / scp / QR upload)
# -> outputs/<timestamp>/flythrough.mp4  and  outputs/latest.mp4
```
The model loads once; each new batch reconstructs in seconds. Serve `outputs/`
(`python -m http.server 8080`) to show the videos, or open the `.ply` in
[superspl.at/view](https://superspl.at/view) for an interactive splat.

## Notes / gotchas
- **API:** `anysplat_recon.py` follows the AnySplat README; if imports/signatures
  differ, the ground truth is `AnySplat/demo_gradio.py` — adjust the 3 marked lines.
- **HEIC** is auto-converted to JPG (pillow-heif).
- **Output** is Gaussians (`.ply`) + a rendered MP4 — not GLB. Our `../viewer/`
  is point-cloud only; use SuperSplat for interactive splats.
- **Quality:** excellent near input views, softer in large unseen gaps — spread
  ~10–15 photos around the subject with overlap.
- **No generative models** — AnySplat renders only observed geometry (on-brand).

See `../PLAN.md` (Phase 6) for the full plan.
