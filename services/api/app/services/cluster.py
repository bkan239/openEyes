"""Event clustering — group scattered clips into one verified story.

Pipeline (README §2):
    1. Time + geo proximity gives candidate groups.
    2. Audio fingerprinting confirms clips share the same moment.

For the hackathon this implements step 1 (time/geo) and leaves step 2 as a
clearly-marked stub. Replace `audio_match` with real chromaprint-style
fingerprint overlap.
"""

from datetime import datetime

from app.models.schemas import Clip

TIME_WINDOW_SEC = 300  # clips within 5 minutes are candidate same-event
GEO_WINDOW_DEG = 0.01  # ~1 km, rough


def _parse(ts: str) -> float | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


def _close_in_time(a: Clip, b: Clip) -> bool:
    ta, tb = _parse(a.captured_at), _parse(b.captured_at)
    if ta is None or tb is None:
        return False
    return abs(ta - tb) <= TIME_WINDOW_SEC


def _close_in_space(a: Clip, b: Clip) -> bool:
    if not a.gps or not b.gps:
        return True  # missing GPS is a weak signal, not a disqualifier
    return (
        abs(a.gps.lat - b.gps.lat) <= GEO_WINDOW_DEG
        and abs(a.gps.lng - b.gps.lng) <= GEO_WINDOW_DEG
    )


def audio_match(a: Clip, b: Clip) -> bool:
    """STUB: confirm two clips share the same soundtrack.

    TODO(team): compute audio fingerprints on upload, store them, and compare
    overlap here. For now we optimistically accept time+geo neighbours.
    """
    return True


def candidates_for(clip: Clip, others: list[Clip]) -> list[Clip]:
    """Return existing clips that plausibly belong to the same event."""
    return [
        o
        for o in others
        if o.id != clip.id
        and _close_in_time(clip, o)
        and _close_in_space(clip, o)
        and audio_match(clip, o)
    ]
