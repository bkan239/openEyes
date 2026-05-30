# CLAUDE.md — OpenEyes

Project guide for Claude Code. See `README.md` for the product pitch and
`DEVELOPMENT.md` for full setup. **One witness can lie. Five cannot.** OpenEyes
verifies real-world events by corroboration across independent recordings.

## Architecture: one backend, multiple frontends

A shared AWS backend serves several independent frontend clients. They all speak
the same API and the same data model.

| Path | What | Stack |
| --- | --- | --- |
| `services/api` | Verification API on AWS Lambda | FastAPI, Mangum, boto3, OpenAI |
| `packages/shared` | Canonical data model + trust-score (source of truth) | TypeScript |
| `iOSApp` | Native capture client (hardware-signed) | SwiftUI (Xcode) |
| `angles` | Map multi-angle web showcase | Vite, React 18, MapLibre GL, Zustand |
| `sst.config.ts` | All AWS infra in one file | SST v3 (Ion) |

- `packages/*` is the only pnpm/Turborepo workspace. `services/api` (uv/Python),
  `iOSApp` (Xcode), and `angles` (own npm) are intentionally independent.
- **There is no `apps/web` anymore** — the Next.js web hub was removed in favour
  of the native iOS capture client. `packages/shared` remains the canonical TS
  model (and the Python/Swift sides mirror it). Don't reference `apps/web`.

## Commands

```bash
pnpm dev                     # backend live on AWS (sst dev): S3 + DynamoDB + API Lambda
pnpm api:dev                 # FastAPI only (uvicorn :8000, docs at /docs)
pnpm angles:dev              # angles web showcase (Vite, :5175)
pnpm typecheck               # TS workspace (packages/shared)
cd services/api && uv run pytest -q
pnpm deploy / pnpm deploy:prod / pnpm remove   # SST → AWS (needs AWS creds)
# iOS: open iOSApp/openEyes/openEyes.xcodeproj in Xcode
```

## Conventions that bite if ignored

1. **Schema parity.** The domain model is defined in `packages/shared/src/types.ts`
   (canonical) and mirrored by `services/api/app/models/schemas.py`, plus any
   frontend that consumes it (iOS `Codable`, angles). JSON on the wire is
   **camelCase**. Change them together. (Skill: `schema-parity`.)
2. **Trust-score is duplicated** on purpose: `packages/shared/src/trust.ts` ↔
   `services/api/app/services/trust.py`. Weights sum to 1.0 and are guarded by a
   pytest. Keep them identical.
3. **DynamoDB is single-table** (`pk`/`sk` + `gsi1`). Key map at the top of
   `services/api/app/services/storage.py`. Add entity prefixes, not new tables.
   Writes go through `_to_item()` — boto3 rejects `float`, so numbers must be
   `Decimal`.
4. **Secrets & resource names** come from env injected by SST. Read them only via
   `services/api/app/core/config.py`. Never hardcode bucket/table names or keys.
5. **Capture provenance.** Every client hashes `SHA-256(media + context)` at
   capture; the iOS app additionally **signs it in the Secure Enclave**. The
   hardware signature is the point of the native app — don't weaken it.
6. **Large media:** `angles/public/demo-clips` already holds ~122 MB of demo
   videos. Do NOT commit more large binaries — use Git LFS or external hosting.

## Agents (`.claude/agents/`)

Delegate area-specific work:
- **backend-api** — `services/api` (FastAPI/Lambda/DynamoDB/OpenAI).
- **ios-app** — `iOSApp` (SwiftUI capture, Secure Enclave signing).
- **angles-mapviz** — the `angles` map/showcase app.
- **infra-sst** — `sst.config.ts` and AWS deploys.

## Skills (`.claude/skills/`)

Project-vendored, available to the whole team:
- **schema-parity** — keep the data model & trust-score in sync across TS/Python/Swift.
- **openeyes-deploy** — the SST → AWS deploy path (not Vercel).
- **fastapi**, **aws-serverless**, **aws-sdk-python-usage** (boto3),
  **maplibre-tile-sources** — official upstream skills for the stack.

## Verify before you commit

```bash
pnpm typecheck
cd services/api && uv run pytest -q
pnpm angles:build            # if you touched angles
```
