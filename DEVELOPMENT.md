# Development

How to run OpenEyes locally and deploy it to AWS. The whole stack is one SST app.

## Stack at a glance

| Layer | Tech | Location |
| --- | --- | --- |
| Hub + capture (PWA) | Next.js (App Router) + Tailwind v4 | `apps/web` |
| API | FastAPI on AWS Lambda (Mangum) | `services/api` |
| Shared types + trust score | TypeScript | `packages/shared` |
| AI verification | OpenAI | `services/api/app/services/verify.py` |
| Media storage | Amazon S3 | provisioned in `sst.config.ts` |
| Event/clip store | Amazon DynamoDB | provisioned in `sst.config.ts` |
| Infrastructure | SST v3 (Ion) | `sst.config.ts` |
| Monorepo | pnpm + Turborepo | root |

## Prerequisites

- Node.js ≥ 20 (`.nvmrc` pins 22) and [pnpm](https://pnpm.io) 10
- Python ≥ 3.11 and [uv](https://docs.astral.sh/uv/) (Lambda runs Python 3.12)
- An AWS account + credentials (`aws configure`, or SSO) for `sst dev`/`deploy`
- An OpenAI API key

## First-time setup

```bash
pnpm install                          # JS workspaces (web + shared)
cd services/api && uv sync && cd -    # Python deps for the API

cp .env.example .env                  # local-only values

# Store the OpenAI key in SST (per stage, encrypted — never committed):
pnpm sst secret set OpenAiApiKey sk-...
```

## Run everything together (recommended)

```bash
pnpm dev          # = sst dev
```

`sst dev` provisions the S3 bucket, DynamoDB table and the FastAPI Lambda in
your personal stage, runs the Lambda live (hot-reloaded), and starts Next.js
wired to the real API URL. Open the printed Web URL.

## Run pieces standalone

```bash
# FastAPI only, against AWS resources from your .env:
pnpm api:dev      # uvicorn on http://localhost:8000  (docs at /docs)

# Next.js only, against whatever NEXT_PUBLIC_API_URL points to:
pnpm web:dev      # http://localhost:3000
```

The web app falls back to demo data (`apps/web/lib/mock.ts`) when the API is
unreachable, so the UI renders even before the backend is up.

## Tests, types, lint

```bash
pnpm typecheck                      # all TS workspaces
pnpm lint
cd services/api && uv run pytest    # API tests (health + trust-score parity)
```

## Deploy

```bash
pnpm deploy                 # your default/personal stage
pnpm deploy:prod            # --stage production (retained, protected)
pnpm remove                 # tear a non-prod stage back down
```

## Conventions

- **Data model is shared.** TS types live in `packages/shared/src/types.ts`;
  the FastAPI side mirrors them in `services/api/app/models/schemas.py`. JSON on
  the wire is camelCase. Change both together.
- **Trust score is duplicated on purpose** (`packages/shared/src/trust.ts` and
  `services/api/app/services/trust.py`) so each side can compute it. A pytest
  guards the weights — keep them in sync.
- **Secrets never land in git.** Local-only values go in `.env`; deployed
  secrets go through `sst secret set`.

## Where the README features live

| README feature | Code |
| --- | --- |
| Capture provenance (hash) | `apps/web/lib/hash.ts`, `services/api/app/routers/clips.py` |
| AI verification | `services/api/app/services/verify.py` |
| News clustering (audio sync) | `services/api/app/services/cluster.py` |
| Trust score | `packages/shared/src/trust.ts` + `.../services/trust.py` |
| Multi-angle player | `apps/web/components/MultiAnglePlayer.tsx` |
| 3D reconstruction | _not yet — future `services/recon3d`_ |
