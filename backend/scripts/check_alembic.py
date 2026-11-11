import sqlite3
from pathlib import Path

db = Path("habit_hero.db")
print("cwd_db", db.resolve(), "exists", db.exists())
conn = sqlite3.connect(db)
print("version_rows", conn.execute("SELECT * FROM alembic_version").fetchall())
print(
    "version_ddl",
    conn.execute(
        "SELECT sql FROM sqlite_master WHERE name='alembic_version'"
    ).fetchall(),
)
print(
    "table_count",
    conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
    ).fetchone()[0],
)
