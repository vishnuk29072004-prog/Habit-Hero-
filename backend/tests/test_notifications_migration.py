"""Stage 10 Alembic migration upgrade/downgrade on temporary SQLite."""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _alembic_config(db_url: str) -> Config:
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


@pytest.fixture()
def temp_sqlite_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    db_path = tmp_path / "stage10_migrate.db"
    url = f"sqlite:///{db_path.as_posix()}"
    monkeypatch.setenv("ALEMBIC_DATABASE_URL", url)
    return url


def test_notifications_migration_upgrade_and_downgrade(temp_sqlite_url: str):
    cfg = _alembic_config(temp_sqlite_url)

    # Full chain from base through Stage 10 revision on temp DB only
    command.upgrade(cfg, "c3f9a1b2d4e5")

    engine = create_engine(temp_sqlite_url)
    insp = inspect(engine)
    assert "notifications" in insp.get_table_names()
    settings_cols = {c["name"] for c in insp.get_columns("user_settings")}
    assert "notifications_enabled" in settings_cols
    assert "remind_habits_daily" in settings_cols
    assert "remind_weekly_summary" in settings_cols

    notif_cols = {c["name"] for c in insp.get_columns("notifications")}
    assert {
        "id",
        "user_id",
        "type",
        "title",
        "message",
        "dedupe_key",
        "created_at",
        "read_at",
    }.issubset(notif_cols)

    with engine.connect() as conn:
        # Additive prefs default to 1 for existing rows path is covered by server_default
        conn.execute(
            text(
                "INSERT INTO users (id, full_name, email, password_hash, created_at, updated_at) "
                "VALUES ('u1', 'T', 't@example.com', 'x', '2026-01-01', '2026-01-01')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO user_settings (user_id, streak_goal_target, updated_at) "
                "VALUES ('u1', 15, '2026-01-01')"
            )
        )
        row = conn.execute(
            text(
                "SELECT notifications_enabled, remind_habits_overdue "
                "FROM user_settings WHERE user_id='u1'"
            )
        ).one()
        assert int(row[0]) == 1
        assert int(row[1]) == 1
        conn.commit()

    # Downgrade Stage 10 only
    command.downgrade(cfg, "2486eb757a7f")
    insp = inspect(engine)
    assert "notifications" not in insp.get_table_names()
    settings_cols = {c["name"] for c in insp.get_columns("user_settings")}
    assert "notifications_enabled" not in settings_cols
    assert "streak_goal_target" in settings_cols

    engine.dispose()
