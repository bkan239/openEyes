"""OpenEyes API — health check only.

Local:  uv run uvicorn app.main:app --reload --port 8000
AWS:    Mangum handler wired in sst.config.ts
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routers import news

app = FastAPI(
    title="OpenEyes API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(news.router)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


handler = Mangum(app)
