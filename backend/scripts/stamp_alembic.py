"""Manually stamp alembic_version to the initial revision."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "habit_hero.db"
REVISION = "e89d66e6c24e"


def main() -> None:
    conn = sqlite3.connect(DB)
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS alembic_version ("
            "version_num VARCHAR(32) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
            ")"
        )
        conn.execute("DELETE FROM alembic_version")
        conn.execute(
            "INSERT INTO alembic_version (version_num) VALUES (?)",
            (REVISION,),
        )
        conn.commit()
        rows = conn.execute("SELECT * FROM alembic_version").fetchall()
        print(f"db={DB}")
        print(f"version_rows={rows}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
