"""Persistence: S3 for media bytes, DynamoDB single-table for metadata.

Single-table key design:
    pk = CLIP#<id>            sk = META               -> a clip
    pk = EVENT#<id>           sk = META               -> an event
    pk = EVENT#<id>           sk = CLIP#<id>          -> clip-in-event membership
    pk = NEWS#CLUSTER#<id>    sk = META               -> RSS news cluster
    pk = NEWS#CLUSTER#<id>    sk = ARTICLE#<id>       -> article in cluster
    pk = NEWS#ARTICLE#<id>    sk = META               -> article index
    gsi1pk = STATUS#<s>       gsi1sk = OCCURRED#<ts>  -> list events by status
    gsi1pk = NEWS#CLUSTER     gsi1sk = OCCURRED#<ts>  -> list news clusters by time
"""

import json
from decimal import Decimal
from typing import Any

from boto3.dynamodb.conditions import Attr
from pydantic import BaseModel

from app.core.aws import dynamo_table, s3_client
from app.core.config import settings
from app.models.schemas import Clip, Event

UPLOAD_URL_TTL = 900  # seconds


def _to_item(model: BaseModel) -> dict[str, Any]:
    """Serialise a Pydantic model for DynamoDB.

    The boto3 resource client rejects Python ``float`` ("Float types are not
    supported. Use Decimal types instead."), so we round-trip through JSON with
    ``parse_float=Decimal`` to turn every number into a ``Decimal``. Keys stay
    snake_case (field names), matching how we read items back.
    """
    return json.loads(model.model_dump_json(), parse_float=Decimal)


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
    dynamo_table().put_item(
        Item={"pk": f"CLIP#{clip.id}", "sk": "META", **_to_item(clip)}
    )


def get_clip(clip_id: str) -> Clip | None:
    res = dynamo_table().get_item(Key={"pk": f"CLIP#{clip_id}", "sk": "META"})
    item = res.get("Item")
    return Clip.model_validate(item) if item else None


def update_clip(clip: Clip) -> None:
    put_clip(clip)


# ── Events (DynamoDB) ─────────────────────────────────────────────────────


def put_event(event: Event) -> None:
    dynamo_table().put_item(
        Item={
            "pk": f"EVENT#{event.id}",
            "sk": "META",
            "gsi1pk": f"STATUS#{event.status}",
            "gsi1sk": f"OCCURRED#{event.occurred_at}",
            **_to_item(event),
        }
    )


def get_event(event_id: str) -> Event | None:
    res = dynamo_table().get_item(Key={"pk": f"EVENT#{event_id}", "sk": "META"})
    item = res.get("Item")
    return Event.model_validate(item) if item else None


def list_events(limit: int = 50) -> list[Event]:
    # Simple scan for the hackathon. Swap for a gsi1 query per status at scale.
    res = dynamo_table().scan(
        FilterExpression=Attr("sk").eq("META") & Attr("pk").begins_with("EVENT#"),
        Limit=limit,
    )
    return [Event.model_validate(i) for i in res.get("Items", [])]
