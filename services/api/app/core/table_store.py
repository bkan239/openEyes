"""Single-table persistence with AWS DynamoDB or Azure Table Storage."""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any

from app.core.config import settings


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _serialize_item(item: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(_json_safe(item)))


def put_item(item: dict[str, Any]) -> None:
    if settings.storage_backend == "azure":
        from app.core.azure_tables import put_entity

        put_entity(item)
        return

    from app.core.aws import dynamo_table

    dynamo_table().put_item(Item=item)


def get_item(pk: str, sk: str) -> dict[str, Any] | None:
    if settings.storage_backend == "azure":
        from app.core.azure_tables import get_entity

        return get_entity(pk, sk)

    from app.core.aws import dynamo_table

    res = dynamo_table().get_item(Key={"pk": pk, "sk": sk})
    return res.get("Item")


def delete_item(pk: str, sk: str) -> None:
    if settings.storage_backend == "azure":
        from app.core.azure_tables import delete_entity

        delete_entity(pk, sk)
        return

    from app.core.aws import dynamo_table

    dynamo_table().delete_item(Key={"pk": pk, "sk": sk})


def query_pk_sk_prefix(pk: str, sk_prefix: str) -> list[dict[str, Any]]:
    if settings.storage_backend == "azure":
        from app.core.azure_tables import query_by_pk_sk_prefix

        return query_by_pk_sk_prefix(pk, sk_prefix)

    from boto3.dynamodb.conditions import Key

    from app.core.aws import dynamo_table

    res = dynamo_table().query(
        KeyConditionExpression=Key("pk").eq(pk) & Key("sk").begins_with(sk_prefix),
    )
    return res.get("Items", [])


def scan_meta_with_pk_prefix(pk_prefix: str, limit: int = 50) -> list[dict[str, Any]]:
    if settings.storage_backend == "azure":
        from app.core.azure_tables import scan_meta_pk_prefix

        return scan_meta_pk_prefix(pk_prefix, limit=limit)

    from boto3.dynamodb.conditions import Attr

    from app.core.aws import dynamo_table

    res = dynamo_table().scan(
        FilterExpression=Attr("sk").eq("META") & Attr("pk").begins_with(pk_prefix),
        Limit=limit,
    )
    return res.get("Items", [])
