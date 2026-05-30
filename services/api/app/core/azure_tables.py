"""Azure Table Storage backend (PartitionKey = pk, RowKey = sk).

Azure forbids ``/ \\ # ?`` in keys — we encode those before write.
"""

from __future__ import annotations

import json
from decimal import Decimal
from functools import lru_cache
from typing import Any

from azure.data.tables import TableServiceClient

from app.core.config import settings

_KEY_ESCAPES = (
    ("\\", "~5c"),
    ("/", "~2f"),
    ("#", "~23"),
    ("?", "~3f"),
)


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _encode_key(key: str) -> str:
    for char, repl in _KEY_ESCAPES:
        key = key.replace(char, repl)
    return key


def _decode_key(key: str) -> str:
    for char, repl in reversed(_KEY_ESCAPES):
        key = key.replace(repl, char)
    return key


def _odata(value: str) -> str:
    return value.replace("'", "''")


@lru_cache
def _client() -> TableServiceClient:
    conn = settings.azure_storage_connection_string
    if not conn:
        msg = "AZURE_STORAGE_CONNECTION_STRING is required when STORAGE_BACKEND=azure"
        raise RuntimeError(msg)
    return TableServiceClient.from_connection_string(conn)


@lru_cache
def _table_name() -> str:
    return settings.data_table


def _ensure_table() -> None:
    client = _client()
    try:
        client.create_table(_table_name())
    except Exception:  # noqa: BLE001 — table may already exist
        pass


def _to_entity(item: dict[str, Any]) -> dict[str, Any]:
    pk = str(item["pk"])
    sk = str(item["sk"])
    payload = {k: v for k, v in item.items() if k not in {"pk", "sk"}}
    entity: dict[str, Any] = {
        "PartitionKey": _encode_key(pk),
        "RowKey": _encode_key(sk),
        "document": json.dumps(_json_safe(payload)),
    }
    for key in ("gsi1pk", "gsi1sk"):
        if key in item and item[key] is not None:
            entity[key] = _encode_key(str(item[key]))
    return entity


def _from_entity(entity: dict[str, Any]) -> dict[str, Any]:
    doc = json.loads(entity.get("document") or "{}")
    item = {
        "pk": _decode_key(entity["PartitionKey"]),
        "sk": _decode_key(entity["RowKey"]),
        **doc,
    }
    for key in ("gsi1pk", "gsi1sk"):
        if key in entity:
            item[key] = _decode_key(str(entity[key]))
    return item


def put_entity(item: dict[str, Any]) -> None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    table.upsert_entity(_to_entity(item))


def get_entity(pk: str, sk: str) -> dict[str, Any] | None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    try:
        entity = table.get_entity(
            partition_key=_encode_key(pk),
            row_key=_encode_key(sk),
        )
        return _from_entity(dict(entity))
    except Exception:  # noqa: BLE001
        return None


def delete_entity(pk: str, sk: str) -> None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    table.delete_entity(partition_key=_encode_key(pk), row_key=_encode_key(sk))


def query_by_pk_sk_prefix(pk: str, sk_prefix: str) -> list[dict[str, Any]]:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    enc_pk = _odata(_encode_key(pk))
    enc_sk = _odata(_encode_key(sk_prefix))
    enc_sk_upper = _odata(_encode_key(f"{sk_prefix}~"))
    filt = (
        f"PartitionKey eq '{enc_pk}' and RowKey ge '{enc_sk}' and RowKey lt '{enc_sk_upper}'"
    )
    return [_from_entity(dict(e)) for e in table.query_entities(filt)]


def scan_meta_pk_prefix(pk_prefix: str, limit: int = 50) -> list[dict[str, Any]]:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    enc_prefix = _odata(_encode_key(pk_prefix))
    enc_prefix_upper = _odata(_encode_key(f"{pk_prefix}~"))
    enc_meta = _odata(_encode_key("META"))
    items: list[dict[str, Any]] = []
    filt = (
        f"RowKey eq '{enc_meta}' and "
        f"PartitionKey ge '{enc_prefix}' and PartitionKey lt '{enc_prefix_upper}'"
    )
    for entity in table.query_entities(query_filter=filt):
        item = _from_entity(dict(entity))
        items.append(item)
        if len(items) >= limit:
            break
    return items
