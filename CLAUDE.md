# CLAUDE.md — OpenEyes

Project guide for Claude Code. See `README.md` for the product pitch and
`DEVELOPMENT.md` for full setup. **One witness can lie. Five cannot.** OpenEyes
verifies real-world events by corroboration across independent recordings.

## Monorepo layout

| Path | What | Stack |
| --- | --- | --- |
| `apps/web` | Verified hub + PWA capture/upload | Next.js 15 (App Router), React 19, Tailwind v4 |
| `services/api` | Verification API (on AWS Lambda) | FastAPI, Mangum, boto3, OpenAI |
| `packages/shared` | Shared data model + trust-score | TypeScript |
| `angles` | Map multi-angle showcase (**separate Vite app**) | Vite, React 18, MapLibre GL, Zustand |
| `sst.config.ts` | All AWS infra in one file | SST v3 (Ion) |

`apps/web` + `packages/shared` are a pnpm/Turborepo workspace. `services/api` is a
uv-managed Python project. `angles` is standalone (own npm, React 18, port 5175)
and not wired to the backend — it runs on demo data.

## Commands

```bash
pnpm dev                     # full stack live (sst dev): S3+Dynamo+Lambda+Next.js
pnpm web:dev                 # Next.js only
pnpm api:dev                 # FastAPI only (uvicorn :8000, docs at /docs)
pnpm typecheck               # all TS workspaces
cd services/api && uv run pytest -q
pnpm deploy / pnpm deploy:prod / pnpm remove   # SST → AWS (needs AWS creds)
cd angles && npm install && npm run dev        # the showcase app
```

## Conventions that bite if ignored

1. **Schema parity.** The domain model is defined twice: `packages/shared/src/types.ts`
   ↔ `services/api/app/models/schemas.py`. JSON on the wire is **camelCase**. Change
   both. (Skill: `schema-parity`.)
2. **Trust-score is duplicated** on purpose: `packages/shared/src/trust.ts` ↔
   `services/api/app/services/trust.py`. Weights sum to 1.0 and are guarded by a
   pytest. Keep them identical.
3. **DynamoDB is single-table** (`pk`/`sk` + `gsi1`). Key map at the top of
   `services/api/app/services/storage.py`. Add entity prefixes, not new tables.
4. **Secrets & resource names** come from env injected by SST. Read them only via
   `services/api/app/core/config.py` (backend) and `apps/web/lib/config.ts`
   (frontend). Never hardcode bucket/table names or API keys.
5. **`apps/web` is React 19; `angles` is React 18** — don't assume parity.
6. **Large media:** `angles/public/demo-clips` already holds ~122 MB of demo
   videos. Do NOT commit more large binaries — use Git LFS or external hosting.

## Agents (`.claude/agents/`)

Delegate area-specific work to these:
- **backend-api** — `services/api` (FastAPI/Lambda/DynamoDB/OpenAI).
- **web-frontend** — `apps/web` (Next.js/Tailwind/capture flow).
- **infra-sst** — `sst.config.ts` and AWS deploys.
- **angles-mapviz** — the `angles` map/showcase app.

## Skills (`.claude/skills/`)

Project-vendored, available to the whole team:
- **schema-parity** — keep TS ↔ Python types & trust-score in sync.
- **openeyes-deploy** — the SST → AWS deploy path (not Vercel).
- **fastapi**, **aws-serverless**, **aws-sdk-python-usage** (boto3),
  **maplibre-tile-sources** — official upstream skills for the stack.

For Next.js / Tailwind / TypeScript specifics, the globally-available
`nextjs-app-router-patterns`, `tailwind-css`, and `typescript-best-practices`
skills apply.

## Verify before you commit

```bash
pnpm typecheck && pnpm --filter @openeyes/web build
cd services/api && uv run pytest -q
```
