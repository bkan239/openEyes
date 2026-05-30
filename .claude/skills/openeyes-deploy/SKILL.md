---
name: openeyes-deploy
description: Deploy the OpenEyes stack (Next.js hub + FastAPI Lambda + S3 + DynamoDB) to AWS using SST v3. Use when the user wants to deploy OpenEyes, ship to a stage, set up a preview/personal stage, run sst dev, rotate the OpenAI secret, or tear a stage down. This is the AWS/SST deploy path — NOT Vercel.
---

# Deploy OpenEyes (SST → AWS)

Everything is one SST app defined in `sst.config.ts`. There is no separate
frontend/backend deploy — SST provisions S3, DynamoDB, the FastAPI Lambda and the
Next.js hosting together.

## Preflight

1. **AWS credentials** must be available (`aws sts get-caller-identity`). If the
   `aws` CLI or creds are missing, tell the user to run `aws configure` / SSO —
   do not fake a deploy.
2. **OpenAI secret** must be set for the target stage (once per stage):
   ```bash
   pnpm sst secret set OpenAiApiKey sk-...
   ```
3. Dependencies installed: `pnpm install` and `cd services/api && uv sync`.

## Deploy

```bash
# Live dev stage (hot-reloaded Lambda + Next.js wired to the real API):
pnpm dev                 # = sst dev

# Persistent deploy to your personal/default stage:
pnpm deploy

# Production (protected, resources retained on removal):
pnpm deploy:prod         # = sst deploy --stage production
```

Review changes first with `npx sst diff` when touching `sst.config.ts`.

## After deploy

SST prints outputs: `web`, `api`, `bucket`, `table`. Smoke-test:
```bash
curl <api-output>/health        # -> {"ok": true}
```
Open the `web` URL and try the capture → events flow.

## Tear down

```bash
pnpm remove                      # removes a non-prod stage entirely
```
`production` is `protect: true` and retains data — removal is intentionally hard.

## Notes
- Default region is `eu-central-1` (in `sst.config.ts`).
- Use the `aws-serverless` skill for Lambda cold starts, Function URL CORS, and
  timeout/concurrency tuning.
