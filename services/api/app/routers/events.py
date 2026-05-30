"""Read-only event hub endpoints."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import Event
from app.services import storage

router = APIRouter(prefix="/events", tags=["events"])


@router.get("", response_model=list[Event])
def list_events() -> list[Event]:
    return storage.list_events()


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str) -> Event:
    event = storage.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="event not found")
    return event
