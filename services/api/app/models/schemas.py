"""API schemas.

These mirror `packages/shared/src/types.ts` so the frontend and backend agree
on one model. We serialise with camelCase aliases to match the TS interfaces on
the wire, while keeping snake_case in Python.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

EventStatus = Literal["pending", "verified", "disputed"]
ClipStatus = Literal["uploaded", "processing", "matched", "rejected"]
TrustLevel = Literal["low", "medium", "high"]


class _Base(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class GeoPoint(_Base):
    lat: float
    lng: float
    label: str | None = None


class Source(_Base):
    id: str
    device_id: str


class ClipVerification(_Base):
    ai_manipulation_score: float
    provenance_valid: bool
    notes: str | None = None


class Clip(_Base):
    id: str
    event_id: str | None = None
    source_id: str
    media_key: str
    hash: str
    signature: str | None = None
    captured_at: str
    received_at: str
    gps: GeoPoint | None = None
    device_id: str
    duration_sec: float | None = None
    status: ClipStatus = "uploaded"
    verification: ClipVerification | None = None


class TrustSignal(_Base):
    key: str
    label: str
    value: float
    weight: float
    detail: str


class TrustScore(_Base):
    score: float
    level: TrustLevel
    signals: list[TrustSignal]


class Event(_Base):
    id: str
    title: str
    status: EventStatus
    location: GeoPoint | None = None
    occurred_at: str
    created_at: str
    trust: TrustScore
    clips: list[Clip]


# ── Request/response payloads ────────────────────────────────────────────


class CreateUploadUrlRequest(_Base):
    content_type: str
    hash: str
    device_id: str
    captured_at: str
    gps: GeoPoint | None = None


class CreateUploadUrlResponse(_Base):
    clip_id: str
    upload_url: str
    media_key: str


class RegisterClipRequest(_Base):
    clip_id: str
    signature: str | None = None
    duration_sec: float | None = None
