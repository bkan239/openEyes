"""OpenEyes verification API.

FastAPI app exposed two ways:
  - locally via `uv run uvicorn app.main:app --reload`
  - on AWS Lambda via the `handler` below (Mangum), wired up in sst.config.ts.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.core.config import settings
from app.routers import clips, events, verify

app = FastAPI(
    title="OpenEyes API",
    version="0.1.0",
    description="Verify real-world events by corroboration across independent recordings.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clips.router)
app.include_router(events.router)
app.include_router(verify.router)


@app.get("/")
def root() -> dict:
    return {"service": "openeyes-api", "stage": settings.stage, "ok": True}


@app.get("/health")
def health() -> dict:
    return {"ok": True}


# AWS Lambda entrypoint (referenced by sst.config.ts as `app/main.handler`).
handler = Mangum(app)
