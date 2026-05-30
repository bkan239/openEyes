"""Re-run AI verification for a single clip."""

from fastapi import APIRouter, HTTPException

from app.models.schemas import ClipVerification
from app.services import storage
from app.services import verify as verify_svc

router = APIRouter(prefix="/verify", tags=["verify"])


@router.post("/{clip_id}", response_model=ClipVerification)
def verify_clip(clip_id: str) -> ClipVerification:
    clip = storage.get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="clip not found")

    clip.verification = verify_svc.analyze_clip(clip)
    storage.update_clip(clip)
    return clip.verification
