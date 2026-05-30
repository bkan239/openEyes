# OpenEyes API

Minimal **`GET /health`** endpoint returning `{"ok": true}`.

## Deploy on Vercel (recommended)

No AWS credentials needed. One serverless function at the repo root:

```
api/health.ts   →  /api/health  (also /health via rewrite)
vercel.json
```

### Option A — Automatic deploy from GitHub (easiest)

1. Push this repo to GitHub (`github.com/bkan239/openEyes`).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the `openEyes` repository.
3. Leave defaults (root directory `.`, framework **Other**) → **Deploy**.

Vercel installs its GitHub app and then:

- **Production** — every push to `main` deploys to your production URL
- **Preview** — every pull request gets its own preview URL

Smoke test after the first deploy:

```bash
curl https://<your-project>.vercel.app/health   # {"ok":true}
```

No GitHub Actions secrets required for Option A.

### Option B — GitHub Actions (`.github/workflows/deploy-vercel.yml`)

Use this if you want deploy config in the repo or cannot use the Vercel GitHub app.

Add these [GitHub Actions secrets](https://github.com/bkan239/openEyes/settings/secrets/actions):

| Secret | Where to get it |
| --- | --- |
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `npx vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `npx vercel link` |

Pushes to `main` that touch `api/`, `vercel.json`, or `package.json` trigger a production deploy.

### Manual deploy (CLI)

```bash
npm install
npx vercel login          # once
npm run deploy:vercel     # preview URL
npm run deploy:vercel:prod
```

Local dev with Vercel CLI:

```bash
npx vercel dev
curl http://localhost:3000/health
```

## Local development (FastAPI)

Optional — same response shape, useful if you prefer Python locally:

```bash
cd services/api
uv sync
uv run uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/health
```

## RSS news clustering

Manually triggered pipeline that ingests western RSS feeds, clusters articles
with OpenAI embeddings, enriches each cluster (summary, location, time, image),
and stores results in DynamoDB.

```bash
# Trigger ingest (may take 1–3 minutes depending on article count)
curl -X POST http://localhost:8000/news/ingest

# List clusters (newest first)
curl http://localhost:8000/news/clusters

# Cluster detail with source articles
curl http://localhost:8000/news/clusters/<cluster-id>
```

Requires `OPENAI_API_KEY` for real embeddings and summaries (falls back to
deterministic pseudo-embeddings without it). Requires DynamoDB table
`DATA_TABLE` (default `openeyes-dev-data`).

## Deploy on AWS (optional)

Lambda + Function URL via SST or `./scripts/deploy-api.sh`. See root `sst.config.ts` and `scripts/deploy-api.sh`. Requires IAM permissions on your AWS user.
