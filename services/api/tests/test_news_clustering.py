"""Unit tests for news clustering math and pipeline helpers."""

from app.services.news_clustering import (
    ArticleGroup,
    EmbeddedArticle,
    cluster_embedded_articles,
    cosine_similarity,
)
from app.services.news_feeds import RawNewsArticle, _article_id


def _raw(title: str, url: str, source: str = "Test") -> RawNewsArticle:
    return RawNewsArticle(
        id=_article_id(url),
        title=title,
        url=url,
        source_name=source,
        summary=f"Summary of {title}",
        published_at="2026-05-30T12:00:00+00:00",
        image_url=None,
    )


def test_cosine_similarity_identical_vectors():
    vec = [1.0, 0.0, 0.0]
    assert cosine_similarity(vec, vec) == 1.0


def test_cosine_similarity_orthogonal_vectors():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_cluster_groups_similar_pseudo_embeddings():
    a1 = EmbeddedArticle(
        raw=_raw("Major earthquake hits Turkey", "https://example.com/eq1"),
        embedding=[1.0, 0.0, 0.0, 0.0],
    )
    a2 = EmbeddedArticle(
        raw=_raw("Turkey rocked by powerful earthquake", "https://example.com/eq2"),
        embedding=[0.99, 0.01, 0.0, 0.0],
    )
    a3 = EmbeddedArticle(
        raw=_raw("Stock market hits record high", "https://example.com/stocks"),
        embedding=[0.0, 0.0, 1.0, 0.0],
    )

    groups = cluster_embedded_articles([a1, a2, a3], threshold=0.9)
    assert len(groups) == 2
    sizes = sorted(len(g.articles) for g in groups)
    assert sizes == [1, 2]


def test_cluster_keeps_distinct_stories_separate():
    articles = [
        EmbeddedArticle(
            raw=_raw(f"Story {i}", f"https://example.com/s{i}"),
            embedding=vec,
        )
        for i, vec in enumerate(
            [
                [1.0, 0.0, 0.0],
                [0.0, 1.0, 0.0],
                [0.0, 0.0, 1.0],
                [-1.0, 0.0, 0.0],
            ]
        )
    ]
    groups = cluster_embedded_articles(articles, threshold=0.95)
    assert len(groups) == 4


def test_article_group_centroid_updates():
    group = ArticleGroup(
        articles=[
            EmbeddedArticle(
                raw=_raw("A", "https://example.com/a"),
                embedding=[1.0, 0.0],
            )
        ],
        centroid=[1.0, 0.0],
    )
    group.articles.append(
        EmbeddedArticle(
            raw=_raw("B", "https://example.com/b"),
            embedding=[0.0, 1.0],
        )
    )
    from app.services.news_clustering import _mean_embedding

    group.centroid = _mean_embedding([a.embedding for a in group.articles])
    assert group.centroid == [0.5, 0.5]
