#!/usr/bin/env bash
# One-time setup for the AnySplat live pipeline — fully isolated from the working
# recon3d env (VGGT-Omega + nerfstudio on torch 2.4.1/cu124). AnySplat wants
# torch 2.2.0/cu121 + py3.10, so we build a standalone uv venv that touches
# neither the system Python (3.11) nor the system torch.
#
#   bash services/recon3d/inference/setup.sh
#
# Runs on the RunPod pod (CUDA). cu121 is fine on the A40's 12.7 driver.
set -euo pipefail
cd "$(dirname "$0")"

# 1) AnySplat source (MIT). Try the primary org, fall back to the mirror.
if [ ! -d AnySplat ]; then
  git clone https://github.com/InternRobotics/AnySplat.git \
    || git clone https://github.com/OpenRobotLab/AnySplat.git
fi

# 2) isolated env via uv (fetches a standalone Python 3.10)
command -v uv >/dev/null 2>&1 || pip install -q uv
uv venv --python 3.10 .venv-anysplat
# shellcheck disable=SC1091
source .venv-anysplat/bin/activate

# 3) deps — torch first (cu121), then AnySplat's requirements, then our extras
uv pip install torch==2.2.0 torchvision==0.17.0 torchaudio==2.2.0 \
  --index-url https://download.pytorch.org/whl/cu121
uv pip install -r AnySplat/requirements.txt
uv pip install pillow-heif        # iPhone HEIC -> JPG

python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda, "ok", torch.cuda.is_available())
PY

echo
echo "Setup done. Use the env with:"
echo "  source services/recon3d/inference/.venv-anysplat/bin/activate"
echo "Then:  python run_once.py --images-dir ../data/easy_data/pics --out outputs/room"
echo "  or:  python serve.py        # warm watch-folder server"
