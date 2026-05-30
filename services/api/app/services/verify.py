"""AI verification — the per-clip "is it real or AI?" signal.

This is the first line of defense (a single clip is still only a *claim*; the
real strength is corroboration). With an OpenAI key set we ask a vision model to
assess a representative frame for manipulation artifacts; without one we fall
back to a deterministic mock so the pipeline runs end-to-end in the demo.

TODO(team): extract a real frame from the uploaded video (ffmpeg layer) and pass
its presigned URL as image input; add EXIF/metadata provenance checks here too.
"""

import json

from app.core.config import settings
from app.models.schemas import Clip, ClipVerification

_SYSTEM = (
    "You are a media-forensics assistant. Given a description of a captured "
    "clip, estimate the probability that it is AI-generated or manipulated. "
    "Respond as compact JSON: "
    '{"ai_manipulation_score": <0..1>, "notes": "<short reason>"}.'
)


def _mock(clip: Clip) -> ClipVerification:
    # Deterministic-ish placeholder: a signed, hash-registered clip looks clean.
    score = 0.05 if clip.hash else 0.4
    return ClipVerification(
        ai_manipulation_score=score,
        provenance_valid=bool(clip.hash),
        notes="Mock verification (no OPENAI_API_KEY set).",
    )


def analyze_clip(clip: Clip) -> ClipVerification:
    if not settings.openai_api_key:
        return _mock(clip)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        prompt = (
            f"Clip {clip.id}: captured_at={clip.captured_at}, device={clip.device_id}, "
            f"has_signature={bool(clip.signature)}, gps={clip.gps}."
        )
        resp = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        return ClipVerification(
            ai_manipulation_score=float(data.get("ai_manipulation_score", 0.2)),
            provenance_valid=bool(clip.hash),
            notes=str(data.get("notes", "")),
        )
    except Exception as exc:  # noqa: BLE001 — never fail the upload on a verify error
        return ClipVerification(
            ai_manipulation_score=0.2,
            provenance_valid=bool(clip.hash),
            notes=f"Verification degraded: {exc}",
        )
