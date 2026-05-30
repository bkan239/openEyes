# Development

How to run OpenEyes locally and deploy the backend to AWS. A shared backend
(one SST app) serves several independent frontends.

## Stack at a glance

| Layer | Tech | Location |
| --- | --- | --- |
| API | FastAPI on AWS Lambda (Mangum) | `services/api` |
| Shared data model + trust score | TypeScript (canonical) | `packages/shared` |
| AI verification | OpenAI | `services/api/app/services/verify.py` |
| Media storage | Amazon S3 | provisioned in `sst.config.ts` |
| Event/clip store | Amazon DynamoDB | provisioned in `sst.config.ts` |
| Backend infrastructure | SST v3 (Ion) | `sst.config.ts` |
| **Frontend — capture** | iOS / SwiftUI | `iOSApp` |
| **Frontend — web showcase** | Vite + React + MapLibre | `angles` |

## Prerequisites

- Node.js ≥ 20 (`.nvmrc` pins 22) and [pnpm](https://pnpm.io) 10
- Python ≥ 3.11 and [uv](https://docs.astral.sh/uv/) (Lambda runs Python 3.12)
- An AWS account + credentials (`aws configure`, or SSO) for `sst dev`/`deploy`
- An OpenAI API key
- For the iOS app: Xcode. For `angles`: Node (npm).

## First-time setup

```bash
pnpm install                          # TS workspace (packages/shared)
cd services/api && uv sync && cd -    # Python deps for the API
cd angles && npm install && cd -      # web showcase deps

cp .env.example .env                  # local-only values

# Store the OpenAI key in SST (per stage, encrypted — never committed):
pnpm sst secret set OpenAiApiKey sk-...
```

## Run the backend

```bash
pnpm dev          # = sst dev: provisions S3 + DynamoDB + the FastAPI Lambda in
                  # your personal stage and runs the Lambda live (hot-reloaded)

pnpm api:dev      # FastAPI only, against AWS resources from your .env
                  # uvicorn on http://localhost:8000  (docs at /docs)
```

## Run the frontends

```bash
pnpm angles:dev   # web showcase (Vite) on http://localhost:5175

# iOS: open iOSApp/openEyes/openEyes.xcodeproj in Xcode and run on a simulator
# or device. Point it at your API URL (the SST `api` output, or :8000 locally).
```

## Tests, types

```bash
pnpm typecheck                      # TS workspace (packages/shared)
cd services/api && uv run pytest    # API tests (health, trust parity, serialization)
pnpm angles:build                   # type-checks + builds the web showcase
```

## Deploy (backend)

```bash
pnpm deploy                 # your default/personal stage
pnpm deploy:prod            # --stage production (retained, protected)
pnpm remove                 # tear a non-prod stage back down
```

The frontends deploy independently: iOS via Xcode/TestFlight; `angles` via any
static host (or enable the commented `StaticSite` in `sst.config.ts`).

## Conventions

- **Data model is shared.** Canonical TS types live in `packages/shared/src/types.ts`;
  the FastAPI side mirrors them in `services/api/app/models/schemas.py`, and each
  frontend matches them too (iOS `Codable`, angles). JSON on the wire is camelCase.
- **Trust score is duplicated on purpose** (`packages/shared/src/trust.ts` and
  `services/api/app/services/trust.py`). A pytest guards the weights — keep them in sync.
- **DynamoDB writes go through `_to_item()`** — boto3 rejects `float`, so numbers
  must be `Decimal`.
- **Secrets never land in git.** Local-only values go in `.env`; deployed secrets
  go through `sst secret set`.

## Where the README features live

| README feature | Code |
| --- | --- |
| Capture provenance (hash + Secure Enclave signature) | `iOSApp` → `services/api/app/routers/clips.py` |
| AI verification | `services/api/app/services/verify.py` |
| News clustering (audio sync) | `services/api/app/services/cluster.py` |
| Trust score | `packages/shared/src/trust.ts` + `.../services/trust.py` |
| Multi-angle / map view | `angles` (`src/components/Showcase`, `Map`, `LiveMode`) |
| 3D reconstruction | _not yet — future `services/recon3d`_ |
