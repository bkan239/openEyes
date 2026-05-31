# Live demo — runbook (as simple as it gets)

**The loop:** audience adds photos in the app → you press one button → the pod
rebuilds the scene in 3D → the fly-through shows.

## Once (on the pod)
```bash
bash services/recon3d/inference/setup.sh      # installs AnySplat + isolated env
```

## Every time you demo
1. **Start the server** (pod):
   ```bash
   bash services/recon3d/inference/run_pitch.sh
   ```
   Wait for `model ready`. In RunPod, expose **port 8008** as an HTTP service →
   your URL is `https://<POD_ID>-8008.proxy.runpod.net`.

2. **Trigger a reconstruction of the latest captures** — any one of:
   - open the server page (URL above) → press **“Reconstruct latest captures”**
   - or `curl http://localhost:8008/go`

   It downloads the newest audience photos, reconstructs in ~seconds, and the
   fly-through plays. The result is always saved at **`/outputs/latest.mp4`**.

## Where it shows
- **Simplest:** the server's own page (step 2) shows the video.
- **In the `angles` app tab:** set `LIVE_URL` in
  `angles/src/components/Reconstruction/ReconstructionView.tsx` to
  `https://<POD_ID>-8008.proxy.runpod.net/outputs/latest.mp4`, run `angles`
  (`npm run dev`), open the **3D Reconstruction** tab.

## Fallback (can't fail on stage)
If the pod is unreachable, the `angles` tab automatically plays the **bundled**
`angles/public/recon/hero.mp4`. Keep a good upright render there as insurance.

## The captures URL
Pre-set to `https://open-eyes-three.vercel.app/captures/export/zip`. To change it:
`CAPTURES_URL="<url>" bash run_pitch.sh`.
