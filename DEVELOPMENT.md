# Development

How to run OpenEyes locally and deploy it. A shared backend serves several
independent frontends. The **live API runs on Azure App Service**; AWS Lambda
(SST) and Vercel (`/health` only) are alternative targets.

## Stack at a glance

| Layer | Tech | Location |
| --- | --- | --- |
| API (live) | FastAPI on Azure App Service (Oryx) | `services/api` + `infra/` |
| API (alt) | FastAPI on AWS Lambda (Mangum) | `services/api` + `sst.config.ts` |
| News pipeline | RSS → OpenAI embeddings → clustering → enrichment | `services/api/app/services/news_*.py` |
| Storage | DynamoDB **or** Azure Table Storage (single-table) | `app/core/table_store.py` |
| Shared data model + trust score | TypeScript (canonical) | `packages/shared` |
| 3D reconstruction (GPU) | VGGT/VGGT-Omega → point cloud + fly-through | `services/recon3d` |
| **Frontend — capture/news/map** | iOS / SwiftUI | `iOSApp` |
| **Frontend — web showcase** | Vite + React 18 + MapLibre | `angles` |

## Prerequisites

- Node.js ≥ 20 (`.nvmrc` pins 22) and [pnpm](https://pnpm.io) 10
- Python ≥ 3.11 and [uv](https://docs.astral.sh/uv/) (the API targets Python 3.12)
- An OpenAI API key (optional — the news pipeline degrades gracefully without it)
- For the live deploy: an Azure subscription + [`azd`](https://aka.ms/azd). For the
  AWS path: AWS credentials (`aws configure`/SSO) for `sst dev`/`deploy`.
- For the iOS app: Xcode. For `angles`: Node (npm). For `services/recon3d`: a CUDA GPU.

## First-time setup

```bash
pnpm install                          # TS workspace (packages/shared)
cd services/api && uv sync && cd -    # Python deps for the API
cd angles && npm install && cd -      # web showcase deps

cp .env.example .env                  # local-only values (OpenAI key, table names)
```

## Run the backend

```bash
pnpm api:dev      # FastAPI on http://localhost:8000 (docs at /docs)
                  # reads .env; STORAGE_BACKEND=aws|azure picks the store

pnpm dev          # AWS path: sst dev — runs the Lambda live (hot-reloaded)
                  # needs AWS creds; sets DATA_TABLE etc. as env
```

### Exercise the news pipeline

```bash
curl -X POST http://localhost:8000/news/ingest      # ingest → cluster → enrich (1–3 min)
curl http://localhost:8000/news/clusters             # list stories, newest first
curl http://localhost:8000/news/clusters/<id>        # one story + its source articles
```

Without `OPENAI_API_KEY` it still runs (empty embeddings → mostly singleton
clusters, fallback titles/location). Needs a reachable table (`DATA_TABLE`).

## Run the frontends

```bash
pnpm angles:dev   # web showcase (Vite) on http://localhost:5175

# iOS: open iOSApp/openEyes/openEyes.xcodeproj in Xcode and run.
#   DEBUG build  → http://127.0.0.1:8000 (local API)
#   RELEASE build → the Azure App Service URL
#   override with the OPENEYES_API_BASE_URL env var in the Xcode scheme
```

## 3D reconstruction (GPU box only)

`services/recon3d` does not run on a dev Mac (torch/VGGT are CUDA-only). On a GPU
host:

```bash
cd services/recon3d
python run.py --clips-dir data/clips --out out          # → out/scene.glb (point cloud)
python pipeline.py --images-dir data/pics --out roomtest # → fly-through .mp4 (nerfstudio)
python -m http.server 8080                               # then open /viewer/?src=scene.glb
```

See `services/recon3d/README.md` and `PLAN.md` for backends (`vggt` vs gated
`omega`), masking (`--mask-people`), and tuning.

## Tests, types

```bash
pnpm typecheck                      # TS workspace (packages/shared)
cd services/api && uv run pytest    # API tests (health, news api, news clustering)
pnpm angles:build                   # type-checks + builds the web showcase
```

## Deploy

| Target | Deploys | Command |
| --- | --- | --- |
| **Azure App Service** *(live API)* | `services/api` + Azure Tables | `azd provision && azd deploy`, or push to `main` (GitHub Actions `deploy-api-azure.yml`) |
| **AWS Lambda** *(alt API)* | `services/api` + DynamoDB | `pnpm deploy` · `pnpm deploy:prod` · tear down: `pnpm remove` |
| **Vercel** | `angles` (full) + `api/health.ts` (`/health` only) | auto-deploy from `main`, or `pnpm deploy:angles:prod` |

One-time Azure OIDC for GitHub Actions: `./scripts/setup-azure-github-oidc.sh`.
The iOS app deploys via Xcode/TestFlight; `services/recon3d` is run by hand.

## Conventions

- **Data model is shared.** Canonical TS types live in `packages/shared/src/types.ts`;
  the FastAPI side mirrors them in `services/api/app/models/schemas.py`, and each
  frontend matches them (iOS `Codable`, angles). JSON on the wire is camelCase.
- **Trust score is duplicated on purpose** (`packages/shared/src/trust.ts` and
  `services/api/app/services/trust.py`) — keep the weights identical and summing to
  1.0. (The trust path is currently only reached from the not-yet-mounted `clips`
  router; there is no `test_trust.py` guarding it yet.)
- **Storage is backend-agnostic.** `STORAGE_BACKEND=aws|azure` switches between
  DynamoDB and Azure Table Storage at call time (`app/core/table_store.py`).
- **DynamoDB writes go through `_to_item()`** — boto3 rejects `float`, so numbers
  must be `Decimal`.
- **Secrets never land in git.** Local-only values go in `.env`; AWS secrets via
  SST, Azure secrets via Bicep app settings / `azd env`.

## Where the README features live

| README feature | Code | Status |
| --- | --- | --- |
| News clustering (RSS → embeddings → clusters) | `services/api/app/services/news_*.py`, `routers/news.py` | ✅ live |
| Multi-angle / map view | `angles` (`src/components/Showcase`, `Map`, `LiveMode`) | ✅ live |
| Capture provenance (on-device hash) | `iOSApp/.../Capture/CaptureHasher.swift` | 🟡 hash done; signing + upload roadmap |
| 3D reconstruction | `services/recon3d` (`run.py`, `pipeline.py`, `core/`) | 🧪 experimental (GPU) |
| Trust score | `packages/shared/src/trust.ts` + `.../services/trust.py` | 🟡 defined, not wired to a live endpoint |
| Clip upload / AI verify | `services/api/app/routers/{clips,verify}.py` | 📋 code exists, routers not mounted |
