"""Lazily-created boto3 clients.

On Lambda the function role (granted by SST `link`) provides credentials. The
clients are cached module-level so warm invocations reuse the connection.
"""

from functools import lru_cache
from typing import Any

import boto3

from app.core.config import settings


@lru_cache
def dynamo_table() -> Any:
    resource = boto3.resource("dynamodb", region_name=settings.aws_region)
    return resource.Table(settings.data_table)


@lru_cache
def s3_client() -> Any:
    return boto3.client("s3", region_name=settings.aws_region)
