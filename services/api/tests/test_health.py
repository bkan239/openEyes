from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_root() -> None:
    res = client.get("/")
    assert res.json()["service"] == "openeyes-api"
