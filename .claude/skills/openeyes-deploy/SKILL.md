---
name: openeyes-deploy
description: Deploy the OpenEyes backend (FastAPI Lambda + S3 + DynamoDB) to AWS using SST v3. Use when the user wants to deploy OpenEyes, ship to a stage, set up a preview/personal stage, run sst dev, rotate the OpenAI secret, or tear a stage down. This is the AWS/SST deploy path — NOT Vercel. Frontends (iOS, angles) deploy separately.

---

# Deploy OpenEyes (SST → AWS)

The **backend** is one SST app defined in `sst.config.ts`: SST provisions S3,
DynamoDB and the FastAPI Lambda together. The frontends deploy independently —
iOS via Xcode/TestFlight, `angles` via any static host (or the optional
`StaticSite` block in `sst.config.ts`).

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
# Live dev stage (hot-reloaded FastAPI Lambda + provisioned S3/DynamoDB):
pnpm dev                 # = sst dev

# Persistent deploy to your personal/default stage:
pnpm deploy

# Production (protected, resources retained on removal):
pnpm deploy:prod         # = sst deploy --stage production
```

Review changes first with `npx sst diff` when touching `sst.config.ts`.

## After deploy

SST prints outputs: `api`, `bucket`, `table`. Smoke-test:
```bash
curl <api-output>/health        # -> {"ok": true}
```
Then point a frontend (iOS / angles) at the `api` URL and try the capture flow.

## Tear down

```bash
pnpm remove                      # removes a non-prod stage entirely
```
`production` is `protect: true` and retains data — removal is intentionally hard.

## Notes
- Default region is `eu-central-1` (in `sst.config.ts`).
- Use the `aws-serverless` skill for Lambda cold starts, Function URL CORS, and
  timeout/concurrency tuning.
