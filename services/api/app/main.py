"""OpenEyes API — verification backend.

Local:  uv run uvicorn app.main:app --reload --port 8000  (docs at /docs)
AWS:    Mangum handler wired in sst.config.ts
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from mangum import Mangum

from app.routers import clips, events, verify

app = FastAPI(title="OpenEyes API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clips.router)
app.include_router(events.router)
app.include_router(verify.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


handler = Mangum(app)
