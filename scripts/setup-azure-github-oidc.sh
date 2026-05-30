#!/usr/bin/env bash
# One-time: wire GitHub Actions OIDC → Azure for deploy-api-azure.yml
#
# Usage:
#   ./scripts/setup-azure-github-oidc.sh [github-org/repo]
#
# Default repo: bkan239/openEyes (change if needed)
set -euo pipefail

REPO="${1:-bkan239/openEyes}"
APP_NAME="openeyes-github-actions"
RG="${AZURE_RG:-rg-openeyes-github-oidc}"
LOCATION="${AZURE_LOCATION:-westeurope}"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

echo "==> Subscription: $SUBSCRIPTION_ID"
echo "==> GitHub repo:    $REPO"

az group create -n "$RG" -l "$LOCATION" -o none 2>/dev/null || true

if ! az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv | grep -q .; then
  echo "==> Creating app registration: $APP_NAME"
  CLIENT_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
else
  CLIENT_ID="$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)"
  echo "==> Using existing app registration: $CLIENT_ID"
fi

OBJECT_ID="$(az ad app show --id "$CLIENT_ID" --query id -o tsv)"

# Federated credential for main branch
CRED_NAME="github-main"
if ! az ad app federated-credential list --id "$OBJECT_ID" --query "[?name=='$CRED_NAME']" -o tsv | grep -q .; then
  echo "==> Adding federated credential for $REPO @ refs/heads/main"
  az ad app federated-credential create \
    --id "$OBJECT_ID" \
    --parameters "{
      \"name\": \"$CRED_NAME\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:${REPO}:ref:refs/heads/main\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" -o none
fi

# Service principal + Contributor on subscription (deploy scope)
if ! az ad sp list --display-name "$APP_NAME" --query "[0].id" -o tsv | grep -q .; then
  az ad sp create --id "$CLIENT_ID" -o none
fi
SP_OBJECT_ID="$(az ad sp list --display-name "$APP_NAME" --query "[0].id" -o tsv)"
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID" \
  -o none 2>/dev/null || echo "(Contributor role may already exist)"

cat <<EOF

Done. Add these GitHub Actions secrets (Settings → Secrets → Actions):

  AZURE_CLIENT_ID       = $CLIENT_ID
  AZURE_TENANT_ID       = $TENANT_ID
  AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID
  OPENAI_API_KEY        = sk-...   (optional)

Then push to main (or run workflow_dispatch) to deploy via:
  .github/workflows/deploy-api-azure.yml

EOF
