"""DynamoDB / Azure Table persistence for RSS news clusters and articles."""

from __future__ import annotations

from app.core.table_store import (
    delete_item,
    get_item,
    put_item,
    query_pk_sk_prefix,
    scan_meta_with_pk_prefix,
)
from app.models.schemas import NewsArticle, NewsCluster
from app.services.storage import _to_item


def put_news_cluster(cluster: NewsCluster) -> None:
    payload = cluster.model_copy(update={"articles": None})
    put_item(
        {
            "pk": f"NEWS#CLUSTER#{cluster.id}",
            "sk": "META",
            "gsi1pk": "NEWS#CLUSTER",
            "gsi1sk": f"OCCURRED#{cluster.occurred_at}",
            **_to_item(payload),
        }
    )


def get_news_cluster(cluster_id: str, include_articles: bool = False) -> NewsCluster | None:
    item = get_item(f"NEWS#CLUSTER#{cluster_id}", "META")
    if not item:
        return None
    cluster = NewsCluster.model_validate(item)
    if include_articles:
        cluster = cluster.model_copy(update={"articles": list_cluster_articles(cluster_id)})
    return cluster


def list_news_clusters(limit: int = 50) -> list[NewsCluster]:
    items = scan_meta_with_pk_prefix("NEWS#CLUSTER#", limit=limit)
    clusters = [NewsCluster.model_validate(i) for i in items]
    clusters.sort(key=lambda c: c.occurred_at, reverse=True)
    return clusters


def put_news_article(article: NewsArticle) -> None:
    put_item(
        {
            "pk": f"NEWS#CLUSTER#{article.cluster_id}",
            "sk": f"ARTICLE#{article.id}",
            **_to_item(article),
        }
    )
    put_item(
        {
            "pk": f"NEWS#ARTICLE#{article.id}",
            "sk": "META",
            "cluster_id": article.cluster_id,
            **_to_item(article),
        }
    )


def list_cluster_articles(cluster_id: str) -> list[NewsArticle]:
    items = query_pk_sk_prefix(f"NEWS#CLUSTER#{cluster_id}", "ARTICLE#")
    articles = [NewsArticle.model_validate(i) for i in items]
    articles.sort(key=lambda a: a.published_at, reverse=True)
    return articles


def delete_cluster_articles(cluster_id: str) -> None:
    for item in query_pk_sk_prefix(f"NEWS#CLUSTER#{cluster_id}", "ARTICLE#"):
        article_id = item.get("id") or str(item["sk"]).replace("ARTICLE#", "")
        delete_item(f"NEWS#CLUSTER#{cluster_id}", f"ARTICLE#{article_id}")
        delete_item(f"NEWS#ARTICLE#{article_id}", "META")


def replace_cluster_articles(cluster_id: str, articles: list[NewsArticle]) -> None:
    delete_cluster_articles(cluster_id)
    for article in articles:
        put_news_article(article)


def find_cluster_by_article_ids(article_ids: list[str]) -> str | None:
    for article_id in article_ids:
        item = get_item(f"NEWS#ARTICLE#{article_id}", "META")
        if item and item.get("cluster_id"):
            return str(item["cluster_id"])
    return None
