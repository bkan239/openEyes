"""News clustering endpoints — manual ingest + read APIs."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import NewsCluster, NewsIngestResponse
from app.services import news_storage
from app.services.news_pipeline import run_news_ingest

router = APIRouter(prefix="/news", tags=["news"])


@router.post("/ingest", response_model=NewsIngestResponse)
def ingest_news() -> NewsIngestResponse:
    """Manually trigger RSS fetch, embedding clustering, and persistence."""
    return run_news_ingest()


@router.get("/clusters", response_model=list[NewsCluster])
def list_clusters(limit: int = 50, min_articles: int = 1) -> list[NewsCluster]:
    return news_storage.list_news_clusters(limit=limit, min_articles=min_articles)


@router.get("/clusters/{cluster_id}", response_model=NewsCluster)
def get_cluster(cluster_id: str) -> NewsCluster:
    cluster = news_storage.get_news_cluster(cluster_id, include_articles=True)
    if not cluster:
        raise HTTPException(status_code=404, detail="cluster not found")
    return cluster
