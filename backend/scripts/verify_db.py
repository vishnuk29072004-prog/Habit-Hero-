"""Verify SQLite DB creation, tables, and foreign keys."""
from pathlib import Path

from sqlalchemy import text

from app.db.session import engine

EXPECTED_TABLES = {
    "users",
    "user_settings",
    "habits",
    "habit_checkins",
    "goals",
    "day_notes",
    "journal_entries",
    "journal_entry_tags",
    "user_achievements",
    "notifications",
    "refresh_tokens",
    "alembic_version",
}


def main() -> None:
    db_path = Path("habit_hero.db")
    print(f"db_exists={db_path.exists()}")
    if db_path.exists():
        print(f"db_size={db_path.stat().st_size}")

    with engine.connect() as conn:
        fk = conn.execute(text("PRAGMA foreign_keys")).scalar()
        print(f"foreign_keys_via_engine={fk}")
        tables = {
            row[0]
            for row in conn.execute(
                text(
                    "SELECT name FROM sqlite_master "
                    "WHERE type='table' ORDER BY name"
                )
            )
        }
        print(f"tables={sorted(tables)}")
        missing = EXPECTED_TABLES - tables
        extra = tables - EXPECTED_TABLES
        print(f"missing={sorted(missing)}")
        print(f"extra={sorted(extra)}")
        if missing:
            raise SystemExit(1)
        print("verification_ok=True")


if __name__ == "__main__":
    main()
