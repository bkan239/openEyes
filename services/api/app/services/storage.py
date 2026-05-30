"""Persistence: S3/Blob for media bytes, DynamoDB/Azure Tables for metadata."""

import json
from decimal import Decimal
from typing import Any

from pydantic import BaseModel

from app.core.aws import s3_client
from app.core.config import settings
from app.core.table_store import get_item, put_item, scan_meta_with_pk_prefix
from app.models.schemas import Clip, Event

UPLOAD_URL_TTL = 900  # seconds


def _to_item(model: BaseModel) -> dict[str, Any]:
    return json.loads(model.model_dump_json(), parse_float=Decimal)


# ── Media (S3 — AWS only for now) ─────────────────────────────────────────


def media_key_for(clip_id: str, content_type: str) -> str:
    ext = {"video/mp4": "mp4", "video/webm": "webm"}.get(content_type, "bin")
    return f"clips/{clip_id}.{ext}"


def presigned_put_url(media_key: str, content_type: str) -> str:
    return s3_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.media_bucket,
            "Key": media_key,
            "ContentType": content_type,
        },
        ExpiresIn=UPLOAD_URL_TTL,
    )


def presigned_get_url(media_key: str) -> str:
    return s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.media_bucket, "Key": media_key},
        ExpiresIn=UPLOAD_URL_TTL,
    )


# ── Clips ─────────────────────────────────────────────────────────────────


def put_clip(clip: Clip) -> None:
    put_item({"pk": f"CLIP#{clip.id}", "sk": "META", **_to_item(clip)})


def get_clip(clip_id: str) -> Clip | None:
    item = get_item(f"CLIP#{clip_id}", "META")
    return Clip.model_validate(item) if item else None


def update_clip(clip: Clip) -> None:
    put_clip(clip)


# ── Events ────────────────────────────────────────────────────────────────


def put_event(event: Event) -> None:
    put_item(
        {
            "pk": f"EVENT#{event.id}",
            "sk": "META",
            "gsi1pk": f"STATUS#{event.status}",
            "gsi1sk": f"OCCURRED#{event.occurred_at}",
            **_to_item(event),
        }
    )


def get_event(event_id: str) -> Event | None:
    item = get_item(f"EVENT#{event_id}", "META")
    return Event.model_validate(item) if item else None


def list_events(limit: int = 50) -> list[Event]:
    items = scan_meta_with_pk_prefix("EVENT#", limit=limit)
    return [Event.model_validate(i) for i in items]
