# Phase 8 – Backend Architecture (SQLite)

## Stack (locked)

| Layer | Choice |
|-------|--------|
| API | FastAPI (Python) |
| ORM | SQLAlchemy 2.x |
| Migrations | Alembic |
| Database | **SQLite only** |
| DB file | `backend/habit_hero.db` |
| Browser tool | DB Browser for SQLite |

**Not used:** MySQL, PostgreSQL drivers, Redis, extra DB configs.

## Connection settings

```python
DATABASE_URL = "sqlite:///./habit_hero.db"
# engine:
create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # required for FastAPI + SQLite
)
# PRAGMA foreign_keys=ON on every connection
```

Relative path resolves to `backend/habit_hero.db` when the app cwd is `backend/`.

## Frontend → backend mapping

Current frontend persists a global localStorage blob (`habit-hero-data-v3`) plus auth keys. Phase 8 introduces **per-user** rows via `user_id` FKs (frontend today is not multi-tenant).

| Frontend source | SQLite table(s) |
|-----------------|-----------------|
| `habit-hero-users` / AuthContext | `users` |
| Session token | JWT (no session table) or optional `sessions` |
| IndexedDB avatar | `users.avatar_path` (file under `backend/uploads/avatars/`) |
| `habits[]` + `checkins` map | `habits` + `habit_checkins` |
| `goals[]` | `goals` |
| `journalEntries[]` | `journal_entries` (+ optional `journal_entry_tags`) |
| `dayNotes` map | `day_notes` |
| `unlockedAchievements[]` | `user_achievements` |
| `goalTarget` scalar | `user_settings.streak_goal_target` |
| `selectedDate` | **Not persisted** (client UI only) |
| Analytics | **Computed** from habits/checkins/goals/journal (no analytics fact table) |

## Entity relationships

```
users 1──* habits 1──* habit_checkins
users 1──* goals (optional FK → habits)
users 1──* journal_entries (optional FK → habits)
users 1──* day_notes
users 1──1 user_settings
users 1──* user_achievements
```

## Auth notes

- Store password with **passlib/bcrypt** (replace client SHA-256).
- Prefer **JWT** bearer tokens; no MySQL-style session store required.
- Unique email constraint on `users`.

## Analytics persistence

Dashboard / Analytics / Goals progress / Journal streaks remain **derived queries** over:

- `habit_checkins`
- `habits` (scheduling: `frequency`, `week_day`, `start_date`, `archived`)
- `goals`
- `journal_entries`

No denormalized analytics tables in v1.

## Alembic

- Config under `backend/alembic/`
- First revision creates all tables in `habit_hero_schema.sql`
- `env.py` imports SQLAlchemy `Base.metadata`

## Project layout (planned)

```
backend/
  habit_hero.db          # created at runtime / via Alembic
  app/
    main.py
    core/config.py
    db/session.py
    models/
    schemas/
    api/routers/
  alembic/
  docs/PHASE_8_SQLITE_ARCHITECTURE.md
  schema/habit_hero_schema.sql
  requirements.txt
```

## Compatibility with DB Browser for SQLite

- Standard SQLite 3 file, no custom extensions
- Explicit `INTEGER` / `TEXT` / `REAL` types
- Foreign keys declared; enable with `PRAGMA foreign_keys = ON`
- Open `backend/habit_hero.db` directly in DB Browser after creation

## Phase 8 scope

1. Scaffold FastAPI + SQLAlchemy + Alembic + SQLite
2. Implement models matching schema below
3. Auth + CRUD APIs for habits, checkins, goals, journal, day notes, settings, achievements
4. **Do not modify frontend** in Phase 8 (API-first; wire-up is a later phase)

## Out of scope

- MySQL / PostgreSQL
- Frontend API migration
- AI features
- Changing existing React pages
