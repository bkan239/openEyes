"""Orchestrates RSS fetch → embed → cluster → enrich → persist."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

from app.core.config import settings
from app.models.schemas import NewsIngestResponse
from app.services import news_storage
from app.services.news_clustering import (
    ArticleGroup,
    EmbeddedArticle,
    build_cluster,
    cluster_embedded_articles,
    embed_articles,
)
from app.services.news_feeds import RawNewsArticle, fetch_rss_articles


def _to_raw(article: RawNewsArticle | object) -> RawNewsArticle:
    """Normalize stored/news-feed article shapes for cluster rebuilding."""
    if isinstance(article, RawNewsArticle):
        return article
    return RawNewsArticle(
        id=str(getattr(article, "id")),
        title=str(getattr(article, "title")),
        url=str(getattr(article, "url")),
        source_name=str(getattr(article, "source_name")),
        summary=getattr(article, "summary", None),
        published_at=str(getattr(article, "published_at")),
        image_url=getattr(article, "image_url", None),
    )


def _merge_cluster_articles(
    previous: list[object],
    incoming: list[RawNewsArticle],
) -> list[RawNewsArticle]:
    """Union previous and new articles by stable article id."""
    merged: dict[str, RawNewsArticle] = {}
    for article in previous:
        raw = _to_raw(article)
        merged[raw.id] = raw
    for article in incoming:
        merged[article.id] = article
    return list(merged.values())


def run_news_ingest() -> NewsIngestResponse:
    """Manually triggered pipeline: ingest RSS feeds and cluster into stories."""
    started = time.monotonic()

    raw_articles = fetch_rss_articles(settings.news_max_articles_per_run)
    if not raw_articles:
        return NewsIngestResponse(
            articles_fetched=0,
            clusters_created=0,
            clusters_updated=0,
            duration_sec=round(time.monotonic() - started, 2),
        )

    embedded = embed_articles(raw_articles)
    groups = cluster_embedded_articles(embedded)

    # Prefer multi-source clusters; keep strong singletons too.
    groups.sort(key=lambda g: (len({a.raw.source_name for a in g.articles}), len(g.articles)), reverse=True)

    created = 0
    updated = 0
    now = datetime.now(tz=UTC).isoformat()

    for group in groups:
        raws = [a.raw for a in group.articles]
        existing_id = news_storage.find_cluster_by_article_ids([a.id for a in raws])
        cluster_id = existing_id or str(uuid.uuid4())

        if existing_id:
            # Rebuild cluster metadata from ALL cluster articles, not just
            # the incoming batch. This keeps title/summary/location/time aligned
            # with the merged story as new evidence arrives.
            prev = news_storage.get_news_cluster(existing_id)
            previous_articles = list(prev.articles) if prev and prev.articles else []
            merged_raws = _merge_cluster_articles(previous_articles, raws)
            rebuilt_group = ArticleGroup(
                articles=[EmbeddedArticle(raw=a, embedding=[]) for a in merged_raws],
                centroid=[],
            )
            cluster, articles = build_cluster(rebuilt_group, cluster_id, created_at=now)
            if prev:
                cluster = cluster.model_copy(update={"created_at": prev.created_at})
            news_storage.put_news_cluster(cluster)
            news_storage.replace_cluster_articles(cluster_id, articles)
            updated += 1
        else:
            cluster, articles = build_cluster(group, cluster_id, created_at=now)
            news_storage.put_news_cluster(cluster)
            news_storage.replace_cluster_articles(cluster_id, articles)
            created += 1

    return NewsIngestResponse(
        articles_fetched=len(raw_articles),
        clusters_created=created,
        clusters_updated=updated,
        duration_sec=round(time.monotonic() - started, 2),
    )
