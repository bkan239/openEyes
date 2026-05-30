"""Guards the DynamoDB serialisation: boto3's resource client rejects `float`,
so `_to_item` must emit Decimals, and reading items back must rebuild the model.
"""

from decimal import Decimal

from app.models.schemas import Clip, ClipVerification, GeoPoint
from app.services.storage import _to_item


def _has_float(obj: object) -> bool:
    if isinstance(obj, float):
        return True
    if isinstance(obj, dict):
        return any(_has_float(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_has_float(v) for v in obj)
    return False


def _clip() -> Clip:
    return Clip(
        id="c1",
        source_id="s1",
        media_key="clips/c1.mp4",
        hash="0" * 64,
        captured_at="2026-05-30T14:02:00Z",
        received_at="2026-05-30T14:02:03Z",
        device_id="dev1",
        gps=GeoPoint(lat=52.52, lng=13.405),
        verification=ClipVerification(ai_manipulation_score=0.04, provenance_valid=True),
    )


def test_to_item_emits_no_floats() -> None:
    item = _to_item(_clip())
    assert not _has_float(item), "DynamoDB rejects float — every number must be Decimal"
    assert isinstance(item["gps"]["lat"], Decimal)
    assert isinstance(item["verification"]["ai_manipulation_score"], Decimal)


def test_roundtrip_decimal_back_to_model() -> None:
    # Simulate what DynamoDB hands back: the stored item plus key attributes.
    item = {"pk": "CLIP#c1", "sk": "META", **_to_item(_clip())}
    restored = Clip.model_validate(item)
    assert restored.id == "c1"
    assert restored.gps is not None and abs(restored.gps.lat - 52.52) < 1e-9
    assert restored.verification is not None
    assert abs(restored.verification.ai_manipulation_score - 0.04) < 1e-9
