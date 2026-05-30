---
name: openeyes-deploy
description: Deploy the OpenEyes health API (FastAPI on AWS Lambda) using SST v3. Use when the user wants to deploy OpenEyes backend, run sst dev/deploy, or tear a stage down. No Docker — native Python Lambda runtime.

---

# Deploy OpenEyes API (SST → AWS Lambda)

The backend is a single Lambda Function URL defined in `sst.config.ts`, exposing `GET /health`.

## Preflight

1. **AWS credentials** — `aws sts get-caller-identity` must succeed.
2. **Dependencies** — `pnpm install` and `cd services/api && uv sync`.

## Deploy

```bash
pnpm dev          # sst dev — live Lambda + hot reload
pnpm deploy       # persistent deploy to default stage
pnpm deploy:prod  # production stage (protected)
```

## After deploy

```bash
curl <api-output>/health   # {"ok":true}
```

## Tear down

```bash
pnpm remove   # non-prod stages only; production is protected
```

Default region: `eu-central-1`.
