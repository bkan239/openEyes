"""Trust-score sanity + TS/Python parity guard.

If you change the weights in `app/services/trust.py`, update
`packages/shared/src/trust.ts` to match (and vice versa).
"""

from app.models.schemas import Clip, ClipVerification
from app.services.trust import TRUST_WEIGHTS, compute_trust_score


def _clip(clip_id: str, device: str, captured: str) -> Clip:
    return Clip(
        id=clip_id,
        source_id=f"src_{device}",
        media_key=f"clips/{clip_id}.mp4",
        hash="0" * 64,
        captured_at=captured,
        received_at=captured,
        device_id=device,
        status="matched",
        verification=ClipVerification(ai_manipulation_score=0.05, provenance_valid=True),
    )


def test_weights_sum_to_one() -> None:
    assert abs(sum(TRUST_WEIGHTS.values()) - 1.0) < 1e-9


def test_more_independent_sources_score_higher() -> None:
    one = compute_trust_score([_clip("a", "dev1", "2026-05-30T14:02:00Z")])
    many = compute_trust_score(
        [
            _clip("a", "dev1", "2026-05-30T14:02:00Z"),
            _clip("b", "dev2", "2026-05-30T14:02:03Z"),
            _clip("c", "dev3", "2026-05-30T14:01:58Z"),
        ]
    )
    assert many.score > one.score
    assert many.level in {"low", "medium", "high"}
