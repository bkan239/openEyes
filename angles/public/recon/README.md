# recon/ — reconstruction video for the "3D Reconstruction" tab

Put the rendered fly-through here as **`hero.mp4`** (referenced by
`ReconstructionView.tsx` as `/recon/hero.mp4`).

Get it from the pod's AnySplat pipeline, e.g. `services/recon3d/inference/outputs/live/hero.mp4`,
and copy it to `angles/public/recon/hero.mp4`.

To show the **live** pod result instead of this bundled file, edit
`RECON_VIDEO_SRC` in `src/components/Reconstruction/ReconstructionView.tsx` to the
RunPod proxy URL (`https://<POD_ID>-8008.proxy.runpod.net/outputs/latest.mp4`).
