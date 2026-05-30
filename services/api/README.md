# OpenEyes API

FastAPI service, deployed to AWS Lambda via Mangum (see root `sst.config.ts`,
function handler `services/api/app/main.handler`).

## Layout

```
app/
├── main.py            # FastAPI app + Mangum Lambda handler
├── core/
│   ├── config.py      # settings (env / SST-injected)
│   └── aws.py         # boto3 clients (S3, DynamoDB)
├── models/
│   └── schemas.py     # Pydantic models (mirror of packages/shared types)
├── routers/
│   ├── clips.py       # upload-url, register, media redirect, clustering
│   ├── events.py      # list / get events
│   └── verify.py      # re-run AI verification on a clip
└── services/
    ├── storage.py     # S3 presign + DynamoDB single-table access
    ├── verify.py      # OpenAI per-clip manipulation signal
    ├── cluster.py     # time/geo (+ audio-sync stub) event clustering
    └── trust.py       # trust-score model (mirror of shared/trust.ts)
```

## Local development

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
# Interactive docs: http://localhost:8000/docs
uv run pytest
```

Local runs read config from the repo-root `.env`. AWS resource access uses your
ambient AWS credentials; on Lambda the SST-granted role provides them instead.

## Key flow

1. `POST /clips/upload-url` → pre-registers provenance, returns a presigned S3 PUT URL.
2. Browser uploads bytes directly to S3.
3. `POST /clips` → runs AI verification, then clusters the clip into an event.
4. `GET /events` / `GET /events/{id}` → the verified hub reads from here.
