"""Trust-score model — Python mirror of `packages/shared/src/trust.ts`.

Keep the weights and logic in sync with the TS version. There's a parity test
stub in tests/ to guard against drift.
"""

from datetime import datetime

from app.models.schemas import Clip, TrustScore, TrustSignal

TRUST_WEIGHTS = {
    "provenance": 0.20,
    "independent_sources": 0.30,
    "time_location": 0.15,
    "audio_sync": 0.20,
    "manipulation": 0.15,
}
STRONG_CORROBORATION = 5


def _clamp01(n: float) -> float:
    return max(0.0, min(1.0, n))


def trust_level(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def _parse(ts: str) -> float | None:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
    except (ValueError, AttributeError):
        return None


def compute_trust_score(clips: list[Clip]) -> TrustScore:
    n = len(clips)
    verified = [c for c in clips if c.verification]

    distinct_devices = len({c.device_id for c in clips})
    independence = _clamp01(distinct_devices / STRONG_CORROBORATION)

    provenance_ok = sum(1 for c in verified if c.verification and c.verification.provenance_valid)
    provenance = 0.0 if n == 0 else provenance_ok / n

    if verified:
        avg_manip = sum(
            (c.verification.ai_manipulation_score if c.verification else 0.0) for c in verified
        ) / len(verified)
    else:
        avg_manip = 0.0
    manipulation = _clamp01(1 - avg_manip)

    times = [t for t in (_parse(c.captured_at) for c in clips) if t is not None]
    if len(times) > 1:
        spread_min = (max(times) - min(times)) / 60.0
        time_location = _clamp01(1 - (spread_min - 5) / 55)
    elif len(times) == 1:
        time_location = 0.5
    else:
        time_location = 0.0

    matched = sum(1 for c in clips if c.status == "matched")
    audio_sync = 0.0 if n <= 1 else _clamp01(matched / n)

    signals = [
        TrustSignal(
            key="provenance",
            label="Capture provenance",
            value=provenance,
            weight=TRUST_WEIGHTS["provenance"],
            detail=f"{provenance_ok}/{n} clips untampered since capture (signed hash match)",
        ),
        TrustSignal(
            key="independentSources",
            label="Independent sources",
            value=independence,
            weight=TRUST_WEIGHTS["independent_sources"],
            detail=f"{distinct_devices} independent device(s) corroborating",
        ),
        TrustSignal(
            key="timeLocation",
            label="Time & location consistency",
            value=time_location,
            weight=TRUST_WEIGHTS["time_location"],
            detail=(
                "Capture times fall within a consistent window"
                if len(times) > 1
                else "Not enough timestamps to corroborate"
            ),
        ),
        TrustSignal(
            key="audioSync",
            label="Audio sync",
            value=audio_sync,
            weight=TRUST_WEIGHTS["audio_sync"],
            detail=f"{matched}/{n} clips share the same soundtrack",
        ),
        TrustSignal(
            key="manipulation",
            label="Manipulation scan",
            value=manipulation,
            weight=TRUST_WEIGHTS["manipulation"],
            detail=(
                "No clips scanned yet"
                if not verified
                else f"No tampering detected (avg AI score {avg_manip * 100:.0f}%)"
            ),
        ),
    ]

    score = _clamp01(sum(s.value * s.weight for s in signals))
    return TrustScore(score=score, level=trust_level(score), signals=signals)
