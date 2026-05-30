"""Persistence: S3 for media bytes, DynamoDB single-table for metadata.

Single-table key design:
    pk = CLIP#<id>        sk = META               -> a clip
    pk = EVENT#<id>       sk = META               -> an event
    pk = EVENT#<id>       sk = CLIP#<id>          -> clip-in-event membership
    gsi1pk = STATUS#<s>   gsi1sk = OCCURRED#<ts>  -> list events by status
"""

from typing import Any

from boto3.dynamodb.conditions import Key

from app.core.aws import dynamo_table, s3_client
from app.core.config import settings
from app.models.schemas import Clip, Event

UPLOAD_URL_TTL = 900  # seconds


# ── Media (S3) ────────────────────────────────────────────────────────────


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


# ── Clips (DynamoDB) ──────────────────────────────────────────────────────


def put_clip(clip: Clip) -> None:
    item: dict[str, Any] = {
        "pk": f"CLIP#{clip.id}",
        "sk": "META",
        **clip.model_dump(mode="json"),
    }
    dynamo_table().put_item(Item=item)


def get_clip(clip_id: str) -> Clip | None:
    res = dynamo_table().get_item(Key={"pk": f"CLIP#{clip_id}", "sk": "META"})
    item = res.get("Item")
    return Clip.model_validate(item) if item else None


def update_clip(clip: Clip) -> None:
    put_clip(clip)


# ── Events (DynamoDB) ─────────────────────────────────────────────────────


def put_event(event: Event) -> None:
    table = dynamo_table()
    table.put_item(
        Item={
            "pk": f"EVENT#{event.id}",
            "sk": "META",
            "gsi1pk": f"STATUS#{event.status}",
            "gsi1sk": f"OCCURRED#{event.occurred_at}",
            **event.model_dump(mode="json"),
        }
    )


def get_event(event_id: str) -> Event | None:
    res = dynamo_table().get_item(Key={"pk": f"EVENT#{event_id}", "sk": "META"})
    item = res.get("Item")
    return Event.model_validate(item) if item else None


def list_events(limit: int = 50) -> list[Event]:
    # Simple scan for the hackathon. Swap for a gsi1 query per status at scale.
    res = dynamo_table().scan(
        FilterExpression=Key("sk").eq("META") & Key("pk").begins_with("EVENT#"),
        Limit=limit,
    )
    return [Event.model_validate(i) for i in res.get("Items", [])]
