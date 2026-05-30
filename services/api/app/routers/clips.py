"""Clip upload, registration and clustering."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.models.schemas import (
    Clip,
    CreateUploadUrlRequest,
    CreateUploadUrlResponse,
    Event,
    RegisterClipRequest,
)
from app.services import cluster, storage
from app.services import verify as verify_svc
from app.services.trust import compute_trust_score

router = APIRouter(prefix="/clips", tags=["clips"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/upload-url", response_model=CreateUploadUrlResponse)
def create_upload_url(req: CreateUploadUrlRequest) -> CreateUploadUrlResponse:
    """Issue a presigned S3 URL and pre-register the clip's provenance."""
    clip_id = f"clip_{uuid.uuid4().hex[:12]}"
    media_key = storage.media_key_for(clip_id, req.content_type)

    storage.put_clip(
        Clip(
            id=clip_id,
            event_id=None,
            source_id=f"src_{req.device_id}",
            media_key=media_key,
            hash=req.hash,
            captured_at=req.captured_at,
            received_at=_now(),  # server-stamped, authoritative
            gps=req.gps,
            device_id=req.device_id,
            status="uploaded",
        )
    )

    return CreateUploadUrlResponse(
        clip_id=clip_id,
        upload_url=storage.presigned_put_url(media_key, req.content_type),
        media_key=media_key,
    )


@router.post("")
def register_clip(req: RegisterClipRequest) -> dict:
    """Finalise a clip after the bytes are uploaded: verify, then cluster."""
    clip = storage.get_clip(req.clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="clip not found")

    if req.signature:
        clip.signature = req.signature
    if req.duration_sec is not None:
        clip.duration_sec = req.duration_sec

    # 1. Per-clip AI verification (first line of defense).
    clip.verification = verify_svc.analyze_clip(clip)
    clip.status = "processing"
    storage.update_clip(clip)

    # 2. Corroboration: assign to a matching event (or seed a new one).
    event = _assign_to_event(clip)

    return {"ok": True, "clipId": clip.id, "eventId": event.id}


@router.get("/{clip_id}/media")
def get_clip_media(clip_id: str) -> RedirectResponse:
    """Redirect to a short-lived presigned URL for the stored media."""
    clip = storage.get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="clip not found")
    return RedirectResponse(storage.presigned_get_url(clip.media_key))


def _assign_to_event(clip: Clip) -> Event:
    """Find an event this clip corroborates, or create a new candidate event."""
    events = storage.list_events()
    target = next((ev for ev in events if cluster.candidates_for(clip, ev.clips)), None)

    if target is None:
        event = Event(
            id=f"evt_{uuid.uuid4().hex[:12]}",
            title="Unverified event",
            status="pending",
            location=clip.gps,
            occurred_at=clip.captured_at,
            created_at=_now(),
            trust=compute_trust_score([clip]),
            clips=[clip],
        )
        clip.event_id = event.id
        storage.update_clip(clip)
        storage.put_event(event)
        return event

    # Attach to the existing event and promote everyone to "matched".
    clip.event_id = target.id
    clip.status = "matched"
    storage.update_clip(clip)

    refreshed: list[Clip] = []
    for c in target.clips:
        if c.status != "matched":
            c.status = "matched"
            storage.update_clip(c)
        refreshed.append(c)
    refreshed.append(clip)

    distinct_devices = len({c.device_id for c in refreshed})
    target.clips = refreshed
    target.trust = compute_trust_score(refreshed)
    target.status = "verified" if distinct_devices >= 2 else "pending"
    storage.put_event(target)
    return target
