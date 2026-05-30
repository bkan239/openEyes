#!/bin/bash
set -euo pipefail
cd /home/site/wwwroot

if [ -d antenv/bin ]; then
  # shellcheck disable=SC1091
  source antenv/bin/activate
fi

python -m pip install --quiet -r requirements.txt
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
