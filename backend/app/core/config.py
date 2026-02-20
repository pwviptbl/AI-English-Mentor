from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        enable_decoding=False,
    )

    app_name: str = "AI English Mentor API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_english_mentor"

    jwt_secret_key: str = "change-me-access"
    jwt_refresh_secret_key: str = "change-me-refresh"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    allowed_origins: list[str] = ["http://localhost:3000"]
    cors_allow_all_dev: bool = True

    default_ai_provider: str = "gemini"
    enable_ollama: bool = False
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    gemini_api_key: str | None = None
    gemini_model_correction: str = "gemini-2.0-flash"
    gemini_model_chat: str = "gemini-2.0-flash"
    gemini_model_analysis: str = "gemini-2.0-flash"

    correction_timeout_seconds: int = 8
    chat_timeout_seconds: int = 12
    analysis_timeout_seconds: int = 8

    rate_limit_auth: int = 12
    rate_limit_chat: int = 30
    rate_limit_window_seconds: int = 60

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
