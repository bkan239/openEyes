"""Runtime configuration.

In AWS, every value here is injected by SST (see sst.config.ts): the OpenAI key
comes from an SST Secret, the bucket/table names from linked resources. Locally
they're read from `.env` at the repo root or the process environment.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    stage: str = "local"
    storage_backend: str = "aws"  # aws | azure

    # AWS resources (names injected by SST link/env in deployed stages).
    media_bucket: str = "openeyes-dev-media"
    data_table: str = "openeyes-dev-data"
    aws_region: str = "eu-central-1"

    # Azure Table / Blob (when storage_backend=azure).
    azure_storage_connection_string: str = ""
    azure_storage_account: str = ""

    # OpenAI — verification model. Empty key -> verification runs in mock mode.
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    # Cosine similarity threshold for grouping articles into one story cluster.
    news_cluster_similarity_threshold: float = 0.78
    # Cap articles per ingest run to control cost and latency.
    news_max_articles_per_run: int = 150

    # Comma-separated allowed origins, or "*".
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
