#!/usr/bin/env bash
# Start the warm AnySplat server for the live demo. One command.
#   bash services/recon3d/inference/run_pitch.sh
set -euo pipefail
cd "$(dirname "$0")"

source .venv-anysplat/bin/activate
export HF_HOME="${HF_HOME:-/workspace/hf-cache}"
# Captures come from this URL (pre-set; the /go trigger uses it). Override if needed:
# export CAPTURES_URL="https://.../captures/export/zip"

echo "──────────────────────────────────────────────────────────────"
echo " OpenEyes live server starting on :8008 (model warms in background)"
echo " Trigger a reconstruction of the LATEST captures, any of:"
echo "   • open  http://localhost:8008  → press 'Reconstruct latest captures'"
echo "   • curl  http://localhost:8008/go"
echo " Result video is always at:  /outputs/latest.mp4"
echo "──────────────────────────────────────────────────────────────"
exec uvicorn app:app --host 0.0.0.0 --port 8008
