#!/usr/bin/env bash
# Set GitHub Actions repo secrets for Azure deploy (requires: gh auth login).
set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

CLIENT_ID="${AZURE_CLIENT_ID:-b3e65e77-7614-4002-b25a-819afbc19bb9}"
TENANT_ID="${AZURE_TENANT_ID:-8f7a9797-8857-474c-934a-c344462a81a1}"
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-91a998dd-e03d-4ad7-b928-d30925f43a91}"

gh secret set AZURE_CLIENT_ID -b "$CLIENT_ID"
gh secret set AZURE_TENANT_ID -b "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID -b "$SUBSCRIPTION_ID"

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  gh secret set OPENAI_API_KEY -b "$OPENAI_API_KEY"
  echo "Set OPENAI_API_KEY"
else
  echo "Skip OPENAI_API_KEY (export OPENAI_API_KEY=sk-... to set)"
fi

echo "GitHub repo secrets configured. Push to main or run Deploy API (Azure) workflow."
