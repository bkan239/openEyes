# CLAUDE.md — OpenEyes

Project guide for Claude Code. See `README.md` for the product pitch and
`DEVELOPMENT.md` for full setup. **One witness can lie. Five cannot.** OpenEyes
verifies real-world events by corroboration across independent recordings.

## Architecture: one backend, multiple frontends

A shared backend serves several independent frontend clients. They all speak the
same API and the same data model (JSON on the wire is **camelCase**).

| Path | What | Stack |
| --- | --- | --- |
| `services/api` | Verification + **news** API | FastAPI, Mangum, boto3 / `azure-data-tables`, OpenAI |
| `services/recon3d` | 3D reconstruction pipeline | Python, VGGT/VGGT-Omega, nerfstudio (Splatfacto), YOLO, trimesh |
| `packages/shared` | Canonical data model + trust-score (source of truth) | TypeScript |
| `iOSApp` | Native capture + news/map client (hardware-signed) | SwiftUI (Xcode) |
| `angles` | Map multi-angle web showcase | Vite, React 18, MapLibre GL, Zustand |
| `infra/` + `azure.yaml` | Azure App Service + Storage (the **live** API deploy) | Bicep, `azd` |
| `sst.config.ts` | AWS Lambda Function URL (alternative backend target) | SST v3 (Ion) |

- `packages/*` is the only pnpm/Turborepo workspace. `services/api` (uv/Python),
  `services/recon3d` (own venv, GPU-only), `iOSApp` (Xcode), and `angles` (own npm)
  are intentionally independent.
- **There is no `apps/web`** — the Next.js web hub was removed in favour of the
  native iOS capture client. `packages/shared` remains the canonical TS model
  (the Python/Swift sides mirror it). Don't reference `apps/web`.

## What's actually wired (read this before assuming)

The README pitch is broader than what runs today. The honest current state:

- **Live API surface is small:** `app/main.py` mounts **only** the `news` router
  plus `GET /health`. The `clips`, `events`, and `verify` routers exist on disk
  but are **not mounted** — so clip upload, per-clip AI verify, and trust scoring
  are **not reachable** from the running API. Treat them as roadmap/legacy code,
  not live behavior.
- **The working backend feature is the news pipeline:** RSS ingest → OpenAI
  embeddings (`text-embedding-3-small`) → cosine clustering → LLM enrichment
  (`gpt-4o-mini`) → store. Endpoints: `POST /news/ingest`, `GET /news/clusters`,
  `GET /news/clusters/{id}`. Files: `app/services/news_*.py`, `app/routers/news.py`.
- **The live API runs on Azure App Service** (`app-api-…azurewebsites.net`) with
  Azure Table Storage. AWS Lambda (SST) and Vercel (`/health` only) are alternative
  targets. The iOS app's release build points at the Azure URL.
- **iOS:** camera capture, spatial/time metadata, and on-device SHA-256 hashing are
  real; **Secure Enclave signing and clip upload are not implemented** (upload is a
  local mock). The Discover/Map tabs read the live `/news` API.
- **`services/recon3d`** is implemented but GPU-only and run by hand (not deployed).

## Commands

```bash
# Backend
pnpm api:dev                 # FastAPI only (uvicorn :8000, docs at /docs)
pnpm dev                     # AWS path: sst dev (Lambda Function URL, hot reload)
cd services/api && uv run pytest -q

# News pipeline (against a running API)
curl -X POST localhost:8000/news/ingest      # ingest → cluster → enrich (1–3 min)
curl localhost:8000/news/clusters             # list stories

# Frontends
pnpm angles:dev              # angles web showcase (Vite, :5175)
pnpm typecheck               # TS workspace (packages/shared)
# iOS: open iOSApp/openEyes/openEyes.xcodeproj in Xcode

# 3D (GPU box only)
cd services/recon3d && python run.py --clips-dir data/clips --out out   # → out/scene.glb

# Deploy
azd provision && azd deploy          # Azure App Service (the live API)
pnpm deploy / pnpm deploy:prod       # AWS Lambda via SST
pnpm deploy:angles:prod              # angles → Vercel
```

## Conventions that bite if ignored

1. **Schema parity.** The domain model is defined in `packages/shared/src/types.ts`
   (canonical) and mirrored by `services/api/app/models/schemas.py`, plus any
   frontend that consumes it (iOS `Codable`, angles). JSON on the wire is
   **camelCase**. Change them together. (Skill: `schema-parity`.) The live news
   types (`NewsArticle`, `NewsCluster`, `NewsIngestResponse`) exist on both sides.
2. **Trust-score is duplicated** on purpose: `packages/shared/src/trust.ts` ↔
   `services/api/app/services/trust.py`. Weights sum to 1.0 — keep them identical.
   (There is **no** `tests/test_trust.py` guarding this yet; if you re-wire the
   trust path, add one. The trust code is currently only called by the unmounted
   `clips` router.)
3. **Storage is backend-agnostic & single-table.** `app/core/table_store.py` is the
   façade; it switches between **DynamoDB** (`STORAGE_BACKEND=aws`) and **Azure
   Table Storage** (`STORAGE_BACKEND=azure`) per call. One logical table, keys
   `pk`/`sk` (+ `gsi1pk`/`gsi1sk`); add entity prefixes, not new tables. DynamoDB
   writes go through `_to_item()` in `app/services/storage.py` — boto3 rejects
   `float`, so numbers must be `Decimal`. Media (S3) is the AWS path only.
4. **Secrets & resource names** come from env. Read them only via
   `services/api/app/core/config.py` (`pydantic-settings`). In AWS they're injected
   by SST; on Azure by Bicep app settings (`infra/resources.bicep`). Never hardcode
   bucket/table names or keys.
5. **Capture provenance.** The iOS client hashes `SHA-256(media + ":" +
   "{lat}:{lon}:{iso8601}:{heading}")` at capture (`CaptureHasher`). The
   Secure-Enclave hardware signature is the *intended* point of the native app —
   it is **not implemented yet**; don't claim it works, and don't weaken the plan.
6. **Large media:** `angles/public/demo-clips` and `services/recon3d/data/clips`
   each hold ~122 MB of demo videos (a byte-identical copy of the same 5 clips). Do
   NOT commit more large binaries — use Git LFS or external hosting.

## Agents (`.claude/agents/`)

Delegate area-specific work:
- **backend-api** — `services/api` (FastAPI / news pipeline / storage / OpenAI).
- **ios-app** — `iOSApp` (SwiftUI capture, news/map client).
- **angles-mapviz** — the `angles` map/showcase app.
- **infra-sst** — `sst.config.ts` and the AWS deploy path.
- *(No dedicated agent for `services/recon3d` or the Azure deploy — use
  `backend-api` or a general agent, and `infra/` + `azure.yaml` for Azure.)*

## Skills (`.claude/skills/`)

Project-vendored, available to the whole team:
- **schema-parity** — keep the data model & trust-score in sync across TS/Python/Swift.
- **openeyes-deploy** — the deploy paths (Azure App Service · AWS/SST · Vercel).
- **fastapi**, **aws-serverless**, **aws-sdk-python-usage** (boto3),
  **maplibre-tile-sources** — official upstream skills for the stack.

## Verify before you commit

```bash
pnpm typecheck
cd services/api && uv run pytest -q
pnpm angles:build            # if you touched angles
```
