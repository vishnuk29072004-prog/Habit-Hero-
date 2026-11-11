import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.models import (  # noqa: F401 — register models on metadata
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

config = context.config


def _resolve_database_url() -> str:
    """Prefer ALEMBIC_DATABASE_URL (tests), then config option, then app settings."""
    env_url = os.environ.get("ALEMBIC_DATABASE_URL", "").strip()
    if env_url:
        return env_url
    configured = (config.get_main_option("sqlalchemy.url") or "").strip()
    if configured and not configured.startswith("driver://"):
        return configured
    return settings.database_url


database_url = _resolve_database_url()
config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = _resolve_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = _resolve_database_url()
    section = config.get_section(config.config_ini_section, {}) or {}
    section["sqlalchemy.url"] = url

    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        if url.startswith("sqlite"):
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

        connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
