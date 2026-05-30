"""Warm AnySplat server — load the model ONCE, then reconstruct each new batch of
photos in seconds (no reload, no cold start). This is what makes the live demo fast.

    source .venv-anysplat/bin/activate
    python serve.py

Drop photos into `uploads/` (drag in VS Code / AirDrop / scp / QR upload). When the
batch stops growing, the server reconstructs it, writes a fly-through to
`outputs/<timestamp>/`, and publishes the newest video to `outputs/latest.mp4`.
Then it clears `uploads/` for the next batch.

Watch-folder is intentionally the core (robust, no web stack). A QR→HTTP upload
endpoint can post into the same `uploads/` folder as a thin layer on top.
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

import anysplat_recon as ar

HERE = Path(__file__).resolve().parent
UPLOADS = HERE / "uploads"
OUTPUTS = HERE / "outputs"
POLL_SECONDS = 1.5
MEDIA_EXTS = (".jpg", ".jpeg", ".png", ".heic", ".heif")


def _images(d: Path) -> list[Path]:
    return [p for p in d.iterdir() if p.suffix.lower() in MEDIA_EXTS] if d.exists() else []


def main() -> None:
    UPLOADS.mkdir(exist_ok=True)
    OUTPUTS.mkdir(exist_ok=True)

    model = ar.load_model()
    print(f"[serve] watching {UPLOADS}  (drop photos in; results -> {OUTPUTS})")

    prev_count = -1
    while True:
        files = _images(UPLOADS)
        n = len(files)

        # Process only once a batch has stopped growing (avoids partial uploads).
        if n > 0 and n == prev_count:
            stamp = time.strftime("%Y%m%d_%H%M%S")
            out = OUTPUTS / stamp
            print(f"[serve] batch of {n} images -> reconstructing -> {out}")
            try:
                ar.reconstruct(model, UPLOADS, out)
                video = out / "flythrough.mp4"
                if not video.exists():  # save_interpolated_video may name it differently
                    mp4s = sorted(out.glob("*.mp4"))
                    video = mp4s[0] if mp4s else None
                if video:
                    shutil.copy(video, OUTPUTS / "latest.mp4")
                    print(f"[serve] ✅ done -> {video}  (also outputs/latest.mp4)")
                else:
                    print("[serve] ⚠ no .mp4 produced — check anysplat_recon vs demo_gradio.py")
            except Exception as e:
                print(f"[serve] ✗ reconstruction failed: {e}")
            # clear the batch for the next one
            for f in files:
                f.unlink(missing_ok=True)
            prev_count = -1
        else:
            prev_count = n

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
