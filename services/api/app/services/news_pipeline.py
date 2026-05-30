"""Orchestrates RSS fetch → embed → cluster → enrich → persist."""

from __future__ import annotations

import time
import uuid
from datetime import UTC, datetime

from app.core.config import settings
from app.models.schemas import NewsIngestResponse
from app.services import news_storage
from app.services.news_clustering import (
    build_cluster,
    cluster_embedded_articles,
    embed_articles,
)
from app.services.news_feeds import fetch_rss_articles


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

        cluster, articles = build_cluster(group, cluster_id, created_at=now)

        if existing_id:
            # Preserve original created_at on updates.
            prev = news_storage.get_news_cluster(existing_id)
            if prev:
                cluster = cluster.model_copy(update={"created_at": prev.created_at})
            news_storage.put_news_cluster(cluster)
            news_storage.replace_cluster_articles(cluster_id, articles)
            updated += 1
        else:
            news_storage.put_news_cluster(cluster)
            news_storage.replace_cluster_articles(cluster_id, articles)
            created += 1

    return NewsIngestResponse(
        articles_fetched=len(raw_articles),
        clusters_created=created,
        clusters_updated=updated,
        duration_sec=round(time.monotonic() - started, 2),
    )
