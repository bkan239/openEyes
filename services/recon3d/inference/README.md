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

## Live demo: fetch the app's captures → one hero fly-through

The main app collects everyone's photos and serves them as a **zip at a plain URL**.
On-demand, one command fetches + unzips + reconstructs **one clean 1080p fly-through**:

```bash
source .venv-anysplat/bin/activate
python live.py --url "https://.../captures.zip"
# -> outputs/live/hero.mp4  and  outputs/latest.mp4
```
Show it big (full-screen, looping):
```bash
python -m http.server 8080      # then open http://localhost:8080/show.html
```
`live.py` finds images recursively (nested zip OK), auto-converts HEIC, renders a
single smooth sweep through the recovered poses (novel in-between views = visible
3D), and upscales to 1080p with ffmpeg. It loads the model fresh each run (~1–2 min);
for instant repeated runs keep the warm server (below) up instead.

## Run (manual / testing)

**One-shot (test / A-B vs the optimization pipeline):**
```bash
cd services/recon3d/inference
source .venv-anysplat/bin/activate
python run_once.py --images-dir ../data/easy_data/pics --out outputs/room
# compare outputs/room/*.mp4  vs  ../roomtest/flythrough.mp4 (Splatfacto)
```

**Warm HTTP server — the live QR demo (recommended):**
```bash
uv pip install fastapi "uvicorn[standard]" python-multipart   # once
uvicorn app:app --host 0.0.0.0 --port 8008
```
Expose port **8008** on RunPod (HTTP service) → point a QR code at the proxy URL
`https://<POD_ID>-8008.proxy.runpod.net`. The page is phone-friendly (camera
capture + multi-select): audience picks a few photos → fly-through comes back in
seconds. Model loads once at boot (warmed in the background).

**Warm watch-folder server (simpler alternative):**
```bash
python serve.py
# drop photos into inference/uploads/ (drag / AirDrop / scp) -> outputs/latest.mp4
```
Either way the model stays resident, so each batch reconstructs in seconds. For an
interactive splat, open the exported `.ply` in [superspl.at/view](https://superspl.at/view).

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
