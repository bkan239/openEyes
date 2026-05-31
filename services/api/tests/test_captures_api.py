"""Capture API endpoint smoke tests."""

import io
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import CapturePhoto

client = TestClient(app)


def test_capture_page_available() -> None:
    response = client.get("/capture")
    assert response.status_code == 200
    assert "Photo Capture" in response.text


@patch("app.routers.captures.storage.put_capture")
@patch("app.routers.captures.s3_client")
def test_upload_capture(_mock_s3_client, _mock_put_capture) -> None:
    mock_s3 = MagicMock()
    _mock_s3_client.return_value = mock_s3

    response = client.post(
        "/captures",
        files={"file": ("photo.jpg", b"fake-image-bytes", "image/jpeg")},
        data={"captured_at": "2026-05-31T00:00:00Z"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"].startswith("cap_")
    assert payload["capturedAt"] == "2026-05-31T00:00:00Z"
    mock_s3.upload_fileobj.assert_called_once()


@patch("app.routers.captures.storage.list_captures", return_value=[])
def test_list_captures(_mock_list) -> None:
    response = client.get("/captures")
    assert response.status_code == 200
    assert response.json() == []


@patch("app.routers.captures.s3_client")
@patch("app.routers.captures.storage.list_captures")
def test_export_zip(_mock_list_captures, _mock_s3_client) -> None:
    _mock_list_captures.return_value = [
        CapturePhoto(
            id="cap_1",
            media_key="captures/cap_1.jpg",
            content_type="image/jpeg",
            captured_at="2026-05-31T00:00:00Z",
            uploaded_at="2026-05-31T00:00:01Z",
        )
    ]

    mock_s3 = MagicMock()
    mock_s3.get_object.return_value = {"Body": io.BytesIO(b"img-bytes")}
    _mock_s3_client.return_value = mock_s3

    response = client.get("/captures/export/zip")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")
    assert response.content[:2] == b"PK"
