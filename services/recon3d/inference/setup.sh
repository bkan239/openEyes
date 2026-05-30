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

# 0) system build deps: Python 3.10 headers (Python.h) + a compiler, needed to
#    build torch-scatter / pytorch3d CUDA extensions.
apt-get install -y python3.10-dev build-essential 2>/dev/null || \
  echo "WARNING: could not apt-get python3.10-dev — install it if a build hits 'Python.h: No such file'"

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

# 3) deps — torch first (cu121), then build tools, then AnySplat's requirements.
uv pip install torch==2.2.0 torchvision==0.17.0 torchaudio==2.2.0 \
  --index-url https://download.pytorch.org/whl/cu121
uv pip install "numpy<2"          # torch 2.2 is NOT compatible with numpy 2.x

# pytorch3d (and other CUDA-extension deps) import torch AT BUILD TIME, which a
# PEP517 isolated build can't see -> install with --no-build-isolation, with the
# build tools + nvcc available. RunPod PyTorch images ship nvcc at /usr/local/cuda.
uv pip install setuptools wheel ninja
if [ -x /usr/local/cuda/bin/nvcc ]; then
  export CUDA_HOME=/usr/local/cuda
  export PATH="/usr/local/cuda/bin:$PATH"
fi
export MAX_JOBS="${MAX_JOBS:-4}"
nvcc --version || echo "WARNING: no nvcc found — pytorch3d CUDA build may fail; apt-get install -y cuda-toolkit-12-1"
uv pip install -r AnySplat/requirements.txt --no-build-isolation
uv pip install "numpy<2" pillow-heif   # re-pin numpy<2 (in case reqs bumped it) + HEIC
uv pip install fastapi "uvicorn[standard]" python-multipart   # live HTTP server (app.py)

python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda, "ok", torch.cuda.is_available())
PY

echo
echo "TIP: weights cache on the persistent volume — export HF_HOME=/workspace/hf-cache"
echo "     (anysplat_recon.py sets this automatically when /workspace exists)"

echo
echo "Setup done. Use the env with:"
echo "  source services/recon3d/inference/.venv-anysplat/bin/activate"
echo "Then:  python run_once.py --images-dir ../data/easy_data/pics --out outputs/room"
echo "  or:  python serve.py        # warm watch-folder server"
