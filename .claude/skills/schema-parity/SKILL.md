---
name: schema-parity
description: Keep the OpenEyes data model and trust-score in sync across TypeScript and Python. Use whenever editing packages/shared/src/types.ts, packages/shared/src/trust.ts, services/api/app/models/schemas.py, or services/api/app/services/trust.py — or when adding/removing a field on Event/Clip/Source/TrustScore/NewsCluster/NewsArticle or changing trust weights.
---

# Schema parity (TS ↔ Python)

OpenEyes deliberately defines its domain model in **TypeScript and Python** so
the frontends and the FastAPI backend share one model. `packages/shared` is the
canonical TS definition; the frontends (native iOS via `Codable`, the `angles`
web app) and the API must all match it. JSON on the wire is **camelCase**.

The model spans both the (live) **news** entities — `NewsArticle`, `NewsCluster`,
`NewsIngestResponse` — and the (not-yet-mounted) clip/event/trust entities. The
news types are the ones an actual running endpoint serializes today, so keep their
parity especially tight (the iOS `Services/NewsAPIModels.swift` DTOs mirror them).

## The two pairs

| Concern | TypeScript (source of truth for the wire) | Python (must mirror) |
| --- | --- | --- |
| Types | `packages/shared/src/types.ts` | `services/api/app/models/schemas.py` |
| Trust score | `packages/shared/src/trust.ts` | `services/api/app/services/trust.py` |

## When you change a type

1. Edit **both** `types.ts` and `schemas.py`. Field names: camelCase in TS;
   snake_case in Python (the `to_camel` alias generator + `populate_by_name`
   make it camelCase on the wire — so `received_at` ↔ `receivedAt`).
2. If the field is user-facing, thread it through the relevant FastAPI router and
   any frontend that consumes it (the iOS `Codable` models, the `angles` client).
3. Keep optionality identical (`field?: T` ↔ `field: T | None = None`).

## When you change the trust score

1. The weights in `TRUST_WEIGHTS`, the `STRONG_CORROBORATION` constant, the
   `trustLevel` thresholds, and the per-signal formulas must match **exactly**
   between `trust.ts` and `trust.py`.
2. Weights must sum to 1.0. **Note:** there is currently no `tests/test_trust.py`
   guarding this, and the trust path is only reached from the unmounted `clips`
   router — so check the sum by hand, and if you wire trust into a live endpoint,
   add a parity test.
3. The `signals[].key` values must match between the two so the UI and API agree
   (`provenance`, `independentSources`, `timeLocation`, `audioSync`, `manipulation`).

## Verify before finishing

```bash
pnpm --filter @openeyes/shared typecheck
cd services/api && uv run pytest -q
```

If you only touched one side, that's a bug — stop and update the other side.
