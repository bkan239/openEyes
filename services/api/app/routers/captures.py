"""Simple mobile photo capture endpoints."""

from __future__ import annotations

import io
import uuid
import zipfile
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, StreamingResponse

from app.core.aws import s3_client
from app.core.config import settings
from app.models.schemas import CapturePhoto, CapturePhotoResponse
from app.services import storage

router = APIRouter(prefix="/captures", tags=["captures"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("", response_model=CapturePhotoResponse)
def upload_capture(
    file: Annotated[UploadFile, File(description="Image captured on device")],
    captured_at: Annotated[str, Form(description="Client-side ISO timestamp")],
) -> CapturePhotoResponse:
    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="file must be an image")

    capture_id = f"cap_{uuid.uuid4().hex[:12]}"
    media_key = storage.capture_media_key_for(capture_id, content_type)
    uploaded_at = _now()

    s3_client().upload_fileobj(
        file.file,
        settings.media_bucket,
        media_key,
        ExtraArgs={"ContentType": content_type},
    )

    capture = CapturePhoto(
        id=capture_id,
        media_key=media_key,
        content_type=content_type,
        captured_at=captured_at,
        uploaded_at=uploaded_at,
    )
    storage.put_capture(capture)
    return CapturePhotoResponse(
        id=capture.id,
        media_key=capture.media_key,
        captured_at=capture.captured_at,
        uploaded_at=capture.uploaded_at,
    )


@router.get("", response_model=list[CapturePhoto])
def list_captures(limit: int = 200) -> list[CapturePhoto]:
    return storage.list_captures(limit=limit)


@router.get("/{capture_id}/media")
def get_capture_media(capture_id: str) -> RedirectResponse:
    capture = storage.get_capture(capture_id)
    if not capture:
        raise HTTPException(status_code=404, detail="capture not found")
    return RedirectResponse(storage.presigned_get_url(capture.media_key))


@router.get("/export/zip")
def export_captures_zip(limit: int = 200) -> StreamingResponse:
    captures = storage.list_captures(limit=limit)
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for capture in captures:
            response = s3_client().get_object(Bucket=settings.media_bucket, Key=capture.media_key)
            try:
                data = response["Body"].read()
            finally:
                response["Body"].close()
            filename = capture.media_key.split("/", maxsplit=1)[-1]
            zf.writestr(filename, data)

    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=captures.zip"},
    )
