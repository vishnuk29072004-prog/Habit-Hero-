from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Habit Hero API"
    app_version: str = "0.1.0"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./habit_hero.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    secret_key: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    uploads_dir: str = str(BACKEND_ROOT / "uploads")
    avatar_subdir: str = "avatars"
    max_avatar_bytes: int = 2 * 1024 * 1024
    uploads_url_prefix: str = "/uploads"

    # Optional in-process notification scheduler (disabled by default).
    notifications_scheduler_enabled: bool = False
    notifications_scheduler_interval_seconds: int = 900

    @field_validator("api_v1_prefix")
    @classmethod
    def normalize_prefix(cls, value: str) -> str:
        value = value.strip() or "/api/v1"
        if not value.startswith("/"):
            value = f"/{value}"
        return value.rstrip("/") or "/api/v1"

    @field_validator("secret_key")
    @classmethod
    def secret_key_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("SECRET_KEY must not be empty")
        return value

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def uploads_path(self) -> Path:
        return Path(self.uploads_dir).resolve()

    @property
    def avatars_path(self) -> Path:
        return self.uploads_path / self.avatar_subdir


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
