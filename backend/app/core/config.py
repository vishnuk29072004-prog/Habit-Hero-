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

    # Google Gemini (AI features). Key must never leave the backend.
    gemini_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-3.8-flash")
    gemini_timeout_seconds: float = Field(default=90.0, ge=5.0, le=180.0)

    # Google Calendar OAuth (backend-only). Never expose to the frontend.
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_redirect_uri: str = Field(
        default="http://127.0.0.1:8000/api/v1/calendar/google/callback"
    )
    # Fernet key (url-safe base64 32-byte). Required to store OAuth tokens.
    token_encryption_key: str = Field(default="")
    frontend_app_url: str = Field(default="http://127.0.0.1:5173")

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

    @field_validator("gemini_api_key")
    @classmethod
    def strip_gemini_key(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator("gemini_model")
    @classmethod
    def normalize_gemini_model(cls, value: str) -> str:
        cleaned = (value or "").strip()
        return cleaned or "gemini-3.8-flash"

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @field_validator(
        "google_client_id",
        "google_client_secret",
        "google_redirect_uri",
        "token_encryption_key",
        "frontend_app_url",
    )
    @classmethod
    def strip_google_fields(cls, value: str) -> str:
        return (value or "").strip()

    @property
    def google_calendar_configured(self) -> bool:
        return bool(
            self.google_client_id
            and self.google_client_secret
            and self.google_redirect_uri
            and self.token_encryption_key
        )

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
