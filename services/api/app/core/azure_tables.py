"""Azure Table Storage backend (PartitionKey = pk, RowKey = sk)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from azure.data.tables import TableServiceClient

from app.core.config import settings


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
        "PartitionKey": pk,
        "RowKey": sk,
        "document": json.dumps(payload),
    }
    for key in ("gsi1pk", "gsi1sk"):
        if key in item and item[key] is not None:
            entity[key] = str(item[key])
    return entity


def _from_entity(entity: dict[str, Any]) -> dict[str, Any]:
    doc = json.loads(entity.get("document") or "{}")
    item = {"pk": entity["PartitionKey"], "sk": entity["RowKey"], **doc}
    for key in ("gsi1pk", "gsi1sk"):
        if key in entity:
            item[key] = entity[key]
    return item


def put_entity(item: dict[str, Any]) -> None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    table.upsert_entity(_to_entity(item))


def get_entity(pk: str, sk: str) -> dict[str, Any] | None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    try:
        entity = table.get_entity(partition_key=pk, row_key=sk)
        return _from_entity(dict(entity))
    except Exception:  # noqa: BLE001
        return None


def delete_entity(pk: str, sk: str) -> None:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    table.delete_entity(partition_key=pk, row_key=sk)


def query_by_pk_sk_prefix(pk: str, sk_prefix: str) -> list[dict[str, Any]]:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    filt = f"PartitionKey eq '{pk}' and RowKey ge '{sk_prefix}' and RowKey lt '{sk_prefix}~'"
    return [_from_entity(dict(e)) for e in table.query_entities(filt)]


def scan_meta_pk_prefix(pk_prefix: str, limit: int = 50) -> list[dict[str, Any]]:
    _ensure_table()
    table = _client().get_table_client(_table_name())
    upper = f"{pk_prefix}~"
    filt = (
        f"RowKey eq 'META' and PartitionKey ge '{pk_prefix}' and PartitionKey lt '{upper}'"
    )
    items: list[dict[str, Any]] = []
    for entity in table.query_entities(query_filter=filt):
        items.append(_from_entity(dict(entity)))
        if len(items) >= limit:
            break
    return items
