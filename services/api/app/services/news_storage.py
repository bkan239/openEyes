"""DynamoDB persistence for RSS news clusters and articles.

Key design (single-table):
    pk = NEWS#CLUSTER#<id>   sk = META              -> cluster metadata
    pk = NEWS#CLUSTER#<id>   sk = ARTICLE#<id>      -> article in cluster
    pk = NEWS#ARTICLE#<id>   sk = META              -> article index (cluster lookup)
    gsi1pk = NEWS#CLUSTER    gsi1sk = OCCURRED#<ts>  -> list clusters by time
"""

from __future__ import annotations

from boto3.dynamodb.conditions import Attr, Key

from app.core.aws import dynamo_table
from app.models.schemas import NewsArticle, NewsCluster
from app.services.storage import _to_item


def put_news_cluster(cluster: NewsCluster) -> None:
    payload = cluster.model_copy(update={"articles": None})
    dynamo_table().put_item(
        Item={
            "pk": f"NEWS#CLUSTER#{cluster.id}",
            "sk": "META",
            "gsi1pk": "NEWS#CLUSTER",
            "gsi1sk": f"OCCURRED#{cluster.occurred_at}",
            **_to_item(payload),
        }
    )


def get_news_cluster(cluster_id: str, include_articles: bool = False) -> NewsCluster | None:
    res = dynamo_table().get_item(
        Key={"pk": f"NEWS#CLUSTER#{cluster_id}", "sk": "META"}
    )
    item = res.get("Item")
    if not item:
        return None
    cluster = NewsCluster.model_validate(item)
    if include_articles:
        cluster = cluster.model_copy(update={"articles": list_cluster_articles(cluster_id)})
    return cluster


def list_news_clusters(limit: int = 50) -> list[NewsCluster]:
    res = dynamo_table().scan(
        FilterExpression=Attr("sk").eq("META") & Attr("pk").begins_with("NEWS#CLUSTER#"),
        Limit=limit,
    )
    clusters = [NewsCluster.model_validate(i) for i in res.get("Items", [])]
    clusters.sort(key=lambda c: c.occurred_at, reverse=True)
    return clusters


def put_news_article(article: NewsArticle) -> None:
    dynamo_table().put_item(
        Item={
            "pk": f"NEWS#CLUSTER#{article.cluster_id}",
            "sk": f"ARTICLE#{article.id}",
            **_to_item(article),
        }
    )
    dynamo_table().put_item(
        Item={
            "pk": f"NEWS#ARTICLE#{article.id}",
            "sk": "META",
            "cluster_id": article.cluster_id,
            **_to_item(article),
        }
    )


def list_cluster_articles(cluster_id: str) -> list[NewsArticle]:
    res = dynamo_table().query(
        KeyConditionExpression=Key("pk").eq(f"NEWS#CLUSTER#{cluster_id}")
        & Key("sk").begins_with("ARTICLE#"),
    )
    articles = [NewsArticle.model_validate(i) for i in res.get("Items", [])]
    articles.sort(key=lambda a: a.published_at, reverse=True)
    return articles


def delete_cluster_articles(cluster_id: str) -> None:
    res = dynamo_table().query(
        KeyConditionExpression=Key("pk").eq(f"NEWS#CLUSTER#{cluster_id}")
        & Key("sk").begins_with("ARTICLE#"),
    )
    for item in res.get("Items", []):
        article_id = item.get("id") or item["sk"].replace("ARTICLE#", "")
        dynamo_table().delete_item(
            Key={"pk": f"NEWS#CLUSTER#{cluster_id}", "sk": f"ARTICLE#{article_id}"}
        )
        dynamo_table().delete_item(
            Key={"pk": f"NEWS#ARTICLE#{article_id}", "sk": "META"}
        )


def replace_cluster_articles(cluster_id: str, articles: list[NewsArticle]) -> None:
    delete_cluster_articles(cluster_id)
    for article in articles:
        put_news_article(article)


def find_cluster_by_article_ids(article_ids: list[str]) -> str | None:
    """Return an existing cluster id if any article already belongs to one."""
    for article_id in article_ids:
        res = dynamo_table().get_item(
            Key={"pk": f"NEWS#ARTICLE#{article_id}", "sk": "META"}
        )
        item = res.get("Item")
        if item and item.get("cluster_id"):
            return str(item["cluster_id"])
    return None
