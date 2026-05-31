"""OpenEyes API.

Local:  uv run uvicorn app.main:app --reload --port 8000
AWS:    Mangum handler wired in sst.config.ts
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from mangum import Mangum

from app.routers import captures, news

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
app.include_router(captures.router)

_STATIC_CAPTURE_PAGE = Path(__file__).parent / "static" / "capture" / "index.html"


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse("/capture")


@app.get("/capture")
def capture_page() -> FileResponse:
    return FileResponse(_STATIC_CAPTURE_PAGE)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


handler = Mangum(app)
