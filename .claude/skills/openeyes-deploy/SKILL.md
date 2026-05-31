---
name: openeyes-deploy
description: Deploy the OpenEyes backend (FastAPI). The live API runs on Azure App Service (azd); AWS Lambda via SST is an alternative; Vercel serves /health and the angles showcase. Use when the user wants to deploy OpenEyes, run a deploy/dev command, or tear a stage down.

---

# Deploy OpenEyes

The FastAPI backend (`services/api`) has two deploy targets; the frontends deploy
separately. The running API exposes `GET /health` plus the news pipeline
(`POST /news/ingest`, `GET /news/clusters`, `GET /news/clusters/{id}`).

## Azure App Service — the live API (recommended)

No Docker — App Service runs Python natively (Oryx builds `requirements.txt`).
Provisioned by `infra/*.bicep` + `azure.yaml`; uses Azure Table Storage
(`STORAGE_BACKEND=azure`).

```bash
# Preflight: az login (or OIDC), and azd installed.
azd env new openeyes-dev --location westeurope
azd env config set infra.parameters.environmentName openeyes-dev
azd env config set infra.parameters.location westeurope
azd provision && azd deploy
curl "$(azd env get-values | grep SERVICE_API_URI | cut -d= -f2 | tr -d '"')/health"
```

CI: push to `main` touching `services/api/**` or `infra/**` triggers
`.github/workflows/deploy-api-azure.yml` (env `openeyes-prod`). One-time OIDC:
`./scripts/setup-azure-github-oidc.sh <owner>/<repo>`, then add repo secrets
`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and optional
`OPENAI_API_KEY`.

## AWS Lambda via SST — alternative

`sst.config.ts` defines a single Lambda Function URL (Python 3.12, region
`us-west-1`). Uses DynamoDB (`STORAGE_BACKEND=aws`).

```bash
# Preflight: aws sts get-caller-identity must succeed; pnpm install; uv sync.
pnpm dev          # sst dev — live Lambda + hot reload
pnpm deploy       # persistent deploy to default stage
pnpm deploy:prod  # production stage (protected, retained)
pnpm remove       # tear a non-prod stage back down
```

## Vercel — health + the angles showcase

- `api/health.ts` → `/health` (`{"ok":true}`) on the root Vercel project.
- `angles/` deploys as its own Vercel project (`open-eyes-angles.vercel.app`).
- Both auto-deploy from `main`; or `pnpm deploy:angles:prod`.

## After any API deploy

```bash
curl <api-url>/health         # {"ok":true}
curl <api-url>/news/clusters  # [] until you POST /news/ingest
open <api-url>/docs           # FastAPI Swagger UI
```

If credentials are missing (`az login` / `aws configure`), say so — don't fake a
deploy.
