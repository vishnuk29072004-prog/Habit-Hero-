"""Pytest fixtures — isolated test SQLite database (never the dev DB)."""

from __future__ import annotations

import os
from collections.abc import Generator
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure settings load with a test secret before app import side effects.
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "7"
os.environ["ENVIRONMENT"] = "test"
os.environ["MAX_AVATAR_BYTES"] = str(2 * 1024 * 1024)

from app.core.config import get_settings, settings

get_settings.cache_clear()

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import (  # noqa: F401
    DayNote,
    Goal,
    Habit,
    HabitCheckin,
    JournalEntry,
    JournalEntryTag,
    Notification,
    RefreshToken,
    User,
    UserAchievement,
    UserSettings,
)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, connection_record) -> None:  # noqa: ARG001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        class_=Session,
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def client(
    db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Generator[TestClient, None, None]:
    uploads = tmp_path / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "uploads_dir", str(uploads))

    def _override_get_db() -> Generator[Session, None, None]:
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def register_payload() -> dict:
    return {
        "full_name": "Vishnu",
        "email": "user@example.com",
        "password": "SecurePassword123!",
    }


@pytest.fixture()
def auth_headers(client: TestClient, register_payload: dict) -> dict:
    client.post("/api/v1/auth/register", json=register_payload)
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": register_payload["email"],
            "password": register_payload["password"],
        },
    ).json()
    return {
        "Authorization": f"Bearer {login['data']['access_token']}",
        "refresh_token": login["data"]["refresh_token"],
        "access_token": login["data"]["access_token"],
        "user": login["data"]["user"],
    }


def make_image_bytes(
    fmt: str = "JPEG",
    size: tuple[int, int] = (64, 64),
    color: tuple[int, int, int] = (220, 40, 40),
) -> bytes:
    buffer = BytesIO()
    image = Image.new("RGB", size, color)
    image.save(buffer, format=fmt)
    return buffer.getvalue()
