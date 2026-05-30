"""News API endpoint smoke tests."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@patch("app.routers.news.news_storage.list_news_clusters", return_value=[])
def test_list_clusters(_mock_list):
    resp = client.get("/news/clusters")
    assert resp.status_code == 200
    assert resp.json() == []


@patch("app.routers.news.news_storage.get_news_cluster", return_value=None)
def test_get_missing_cluster(_mock_get):
    resp = client.get("/news/clusters/nonexistent-id")
    assert resp.status_code == 404
