"""Embedding-based news article clustering and LLM enrichment."""

from __future__ import annotations

import json
import math
import re
from difflib import SequenceMatcher
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.core.config import settings
from app.models.schemas import GeoPoint, NewsArticle, NewsCluster
from app.services.news_feeds import RawNewsArticle, fetch_og_image

import httpx


@dataclass
class EmbeddedArticle:
    raw: RawNewsArticle
    embedding: list[float]


@dataclass
class ArticleGroup:
    articles: list[EmbeddedArticle] = field(default_factory=list)
    centroid: list[float] = field(default_factory=list)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _mean_embedding(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []
    dim = len(vectors[0])
    sums = [0.0] * dim
    for vec in vectors:
        for i, val in enumerate(vec):
            sums[i] += val
    return [s / len(vectors) for s in sums]


def _parse_iso_dt(value: str) -> datetime:
    """Parse ISO datetime with sane fallback."""
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return datetime.now(tz=UTC)


def _group_latest_datetime(group: ArticleGroup) -> datetime:
    return max(_parse_iso_dt(item.raw.published_at) for item in group.articles)


def _title_tokens(group: ArticleGroup) -> set[str]:
    tokens: set[str] = set()
    for item in group.articles[:8]:
        for tok in re.findall(r"[a-z0-9]{4,}", item.raw.title.lower()):
            tokens.add(tok)
    return tokens


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _title_entities(group: ArticleGroup) -> set[str]:
    """Extract coarse entity-like tokens from headlines (fallback heuristic)."""
    entities: set[str] = set()
    for item in group.articles[:8]:
        text = item.raw.title
        # Keep capitalized word runs: e.g. "Kanye West", "United Nations".
        for m in re.findall(r"\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", text):
            if len(m) >= 4:
                entities.add(m.lower())
    return entities


def _entity_overlap(group_a: ArticleGroup, group_b: ArticleGroup) -> float:
    return _jaccard(_title_entities(group_a), _title_entities(group_b))


def _title_similarity(a: str, b: str) -> float:
    a_norm = " ".join(re.findall(r"[a-z0-9]+", a.lower()))
    b_norm = " ".join(re.findall(r"[a-z0-9]+", b.lower()))
    if not a_norm or not b_norm:
        return 0.0
    a_set = set(a_norm.split())
    b_set = set(b_norm.split())
    jacc = _jaccard(a_set, b_set)
    seq = SequenceMatcher(None, a_norm, b_norm).ratio()
    contains_bonus = 1.0 if (a_norm in b_norm or b_norm in a_norm) and min(len(a_norm), len(b_norm)) >= 24 else 0.0
    return max(jacc, seq, contains_bonus)


def _fallback_similarity(item: EmbeddedArticle, group: ArticleGroup) -> float:
    """Lexical/time fallback when embeddings are unavailable."""
    if not group.articles:
        return 0.0
    item_dt = _parse_iso_dt(item.raw.published_at)
    group_dt = _group_latest_datetime(group)
    dt_gap = abs((item_dt - group_dt).total_seconds())
    if dt_gap > 24 * 3600:
        return 0.0
    sims = [_title_similarity(item.raw.title, g.raw.title) for g in group.articles[:8]]
    return max(sims) if sims else 0.0


def _merge_related_groups(
    groups: list[ArticleGroup],
    sim_threshold: float,
) -> list[ArticleGroup]:
    """Second-pass merge to collapse obvious near-duplicate story clusters."""
    if len(groups) < 2:
        return groups

    # Slightly more permissive than first-pass assignment, but bounded.
    merge_similarity = max(0.62, sim_threshold - 0.02)
    max_time_gap_seconds = 24 * 3600
    title_overlap_threshold = 0.28

    merged = groups[:]
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(merged):
            j = i + 1
            while j < len(merged):
                a = merged[i]
                b = merged[j]
                centroid_sim = cosine_similarity(a.centroid, b.centroid)
                dt_gap = abs(
                    (_group_latest_datetime(a) - _group_latest_datetime(b)).total_seconds()
                )
                title_overlap = _jaccard(_title_tokens(a), _title_tokens(b))
                entity_overlap = _entity_overlap(a, b)

                should_merge = (
                    dt_gap <= max_time_gap_seconds
                    and (
                        (centroid_sim >= merge_similarity and (title_overlap >= 0.12 or entity_overlap >= 0.12))
                        or title_overlap >= title_overlap_threshold
                        or entity_overlap >= 0.24
                    )
                )

                if should_merge:
                    # Guardrail: avoid runaway mega-clusters unless both semantic
                    # and lexical similarity are strong.
                    combined_size = len(a.articles) + len(b.articles)
                    if (
                        combined_size > 25
                        and (centroid_sim < 0.78 or max(title_overlap, entity_overlap) < 0.2)
                    ):
                        j += 1
                        continue
                    a.articles.extend(b.articles)
                    a.centroid = _mean_embedding([x.embedding for x in a.articles])
                    merged.pop(j)
                    changed = True
                else:
                    j += 1
            i += 1
    return merged


def _pseudo_embedding(text: str, dim: int = 64) -> list[float]:
    """Deterministic fallback when OpenAI embeddings are unavailable."""
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    vec = [0.0] * dim
    for token in tokens:
        h = hash(token)
        idx = h % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(x * x for x in vec))
    return [x / norm for x in vec] if norm else vec


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if not settings.openai_api_key:
        # Match Veriloc behavior: if embeddings are unavailable, do not attempt
        # fuzzy pseudo-similarity clustering that can create random merges.
        return [[] for _ in texts]

    from openai import OpenAI

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.embeddings.create(model=settings.openai_embedding_model, input=texts)
        return [item.embedding for item in resp.data]
    except Exception:
        # Quota/auth/provider outages should not break manual ingest.
        # Fall back to lexical-only clustering path.
        return [[] for _ in texts]


def embed_articles(articles: list[RawNewsArticle]) -> list[EmbeddedArticle]:
    texts = [
        f"{a.title}. {a.summary or ''}".strip()
        for a in articles
    ]
    embeddings = embed_texts(texts)
    return [
        EmbeddedArticle(raw=article, embedding=embedding)
        for article, embedding in zip(articles, embeddings, strict=True)
    ]


def cluster_embedded_articles(
    embedded: list[EmbeddedArticle],
    threshold: float | None = None,
) -> list[ArticleGroup]:
    """Greedy online clustering by cosine similarity to cluster centroids."""
    if not embedded:
        return []

    sim_threshold = threshold if threshold is not None else settings.news_cluster_similarity_threshold
    groups: list[ArticleGroup] = []
    max_assignment_gap_seconds = 24 * 3600

    for item in embedded:
        best_idx = -1
        best_sim = -1.0
        item_dt = _parse_iso_dt(item.raw.published_at)
        item_title_tokens = set(re.findall(r"[a-z0-9]{4,}", item.raw.title.lower()))
        item_entities = {m.lower() for m in re.findall(r"\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", item.raw.title) if len(m) >= 4}
        for i, group in enumerate(groups):
            dt_gap = abs((item_dt - _group_latest_datetime(group)).total_seconds())
            if dt_gap > max_assignment_gap_seconds:
                continue
            if item.embedding and group.centroid:
                sim = cosine_similarity(item.embedding, group.centroid)
            else:
                sim = _fallback_similarity(item, group)
            if sim > best_sim:
                best_sim = sim
                best_idx = i

        fallback_threshold = 0.78
        required_threshold = sim_threshold if item.embedding else fallback_threshold

        if best_idx >= 0 and best_sim >= required_threshold:
            group = groups[best_idx]
            title_overlap = _jaccard(item_title_tokens, _title_tokens(group))
            entity_overlap = _jaccard(item_entities, _title_entities(group))
            strong_similarity = best_sim >= (sim_threshold + 0.1)
            if (not item.embedding) or strong_similarity or title_overlap >= 0.2 or entity_overlap >= 0.2:
                group.articles.append(item)
                group.centroid = _mean_embedding([a.embedding for a in group.articles])
            else:
                groups.append(
                    ArticleGroup(articles=[item], centroid=list(item.embedding))
                )
        else:
            groups.append(
                ArticleGroup(articles=[item], centroid=list(item.embedding))
            )

    # Drop singleton clusters with very short titles (likely noise promos).
    return [g for g in groups if len(g.articles) >= 1]


def _pick_cluster_image(articles: list[RawNewsArticle]) -> str | None:
    for article in articles:
        if article.image_url:
            return article.image_url
    with httpx.Client(follow_redirects=True, timeout=10.0) as client:
        for article in articles[:3]:
            og = fetch_og_image(article.url, client)
            if og:
                return og
    return None


def _latest_published(articles: list[RawNewsArticle]) -> str:
    return max(a.published_at for a in articles)


def _unique_sources(articles: list[RawNewsArticle]) -> int:
    return len({a.source_name for a in articles})


def _enrich_with_llm(group: ArticleGroup) -> dict:
    """Ask the LLM for title, summary, location, and event time."""
    raws = [a.raw for a in group.articles]
    headlines = "\n".join(
        f"- [{a.source_name}] {a.title}" + (f": {a.summary[:200]}" if a.summary else "")
        for a in raws[:12]
    )
    latest = _latest_published(raws)

    def _fallback_enrichment() -> dict:
        title = raws[0].title
        return {
            "title": title,
            "summary": (
                f"Multiple outlets reported on this story. "
                f"Headline from {raws[0].source_name}: {title}. "
                + (raws[0].summary or "")
            )[:800],
            "location_label": "Global",
            "lat": 51.5074,
            "lng": -0.1278,
            "occurred_at": latest,
        }

    if not settings.openai_api_key:
        return _fallback_enrichment()

    from openai import OpenAI

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        system = (
            "You cluster news coverage into one real-world story. "
            "Respond as JSON with keys: title (concise headline), summary (2-4 sentences "
            "explaining what happened), location_label (city/region/country where the event "
            "occurred), lat, lng (approximate coordinates), occurred_at (ISO-8601 UTC estimate "
            "of when the event happened — use the latest credible reporting time if unsure)."
        )
        user = (
            f"Latest article timestamp: {latest}\n\n"
            f"Articles in this cluster:\n{headlines}\n\n"
            "Produce one consolidated story."
        )
        resp = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        return {
            "title": str(data.get("title") or raws[0].title),
            "summary": str(data.get("summary") or raws[0].summary or raws[0].title),
            "location_label": str(data.get("location_label") or "Unknown"),
            "lat": float(data.get("lat", 0.0)),
            "lng": float(data.get("lng", 0.0)),
            "occurred_at": str(data.get("occurred_at") or latest),
        }
    except Exception:
        # Keep ingest operational when the LLM provider is unavailable or over quota.
        return _fallback_enrichment()


def build_cluster(
    group: ArticleGroup,
    cluster_id: str,
    created_at: str | None = None,
) -> tuple[NewsCluster, list[NewsArticle]]:
    raws = [a.raw for a in group.articles]
    enriched = _enrich_with_llm(group)
    image_url = _pick_cluster_image(raws)
    now = created_at or datetime.now(tz=UTC).isoformat()

    articles = [
        NewsArticle(
            id=a.id,
            cluster_id=cluster_id,
            title=a.title,
            url=a.url,
            source_name=a.source_name,
            summary=a.summary,
            published_at=a.published_at,
            image_url=a.image_url,
        )
        for a in raws
    ]

    cluster = NewsCluster(
        id=cluster_id,
        title=enriched["title"],
        summary=enriched["summary"],
        location=GeoPoint(
            lat=enriched["lat"],
            lng=enriched["lng"],
            label=enriched["location_label"],
        ),
        occurred_at=enriched["occurred_at"],
        created_at=now,
        image_url=image_url,
        article_count=len(articles),
        source_count=_unique_sources(raws),
    )
    return cluster, articles
