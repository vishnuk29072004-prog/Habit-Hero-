# Habit Hero Backend (Phase 8)

FastAPI + SQLAlchemy + Alembic + **SQLite** backend.

Database file: `backend/habit_hero.db` (compatible with DB Browser for SQLite).

## Prerequisites

- Python 3.12+
- Windows PowerShell / terminal

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

## Environment configuration

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `sqlite:///./habit_hero.db` | SQLite connection URL |
| `API_V1_PREFIX` | `/api/v1` | API route prefix |
| `CORS_ORIGINS` | Vite origins | Allowed frontend origins |
| `SECRET_KEY` | (change in prod) | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |

SQLite engine uses `check_same_thread=False` and enables `PRAGMA foreign_keys=ON` on every connection.

**Never commit real production secrets.** Change `SECRET_KEY` before any deployment.

## Database migrations (Alembic)

From `backend/` with the virtualenv active:

```powershell
$env:PYTHONPATH = (Get-Location).Path
alembic upgrade head
alembic current
alembic revision --autogenerate -m "describe_change"
alembic downgrade -1
```

Verify tables / FKs:

```powershell
$env:PYTHONPATH = (Get-Location).Path
python scripts\verify_db.py
```

Open `habit_hero.db` in **DB Browser for SQLite** to inspect schema.

## Start the server

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Get-Location).Path
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Authentication

Passwords are hashed with **bcrypt** via Passlib (`password_hash` column). Access and refresh tokens are JWTs signed with `SECRET_KEY` / `HS256`. Refresh tokens are stored **only as SHA-256 hashes** in `refresh_tokens` and are rotated + revoked on refresh/logout.

Reusable dependency: `get_current_user()` in `app/api/deps.py` (Bearer access token).

### Register

`POST /api/v1/auth/register` → **201**

```json
{
  "full_name": "Vishnu",
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "id": "...",
    "full_name": "Vishnu",
    "email": "user@example.com"
  }
}
```

Password rules: min 8 chars, uppercase, lowercase, digit, special character. Email is normalized to lowercase. Duplicate email → **409**.

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "token_type": "bearer",
    "user": {
      "id": "...",
      "full_name": "Vishnu",
      "email": "user@example.com"
    }
  }
}
```

Invalid credentials return the same **401** message whether the email exists or not.

### Current user

`GET /api/v1/auth/me`  
Header: `Authorization: Bearer <access_token>`

### Refresh (rotation)

`POST /api/v1/auth/refresh`

```json
{ "refresh_token": "..." }
```

Returns a new access + refresh pair and **revokes** the previous refresh token. Reusing the old token fails with **401**.

### Logout

`POST /api/v1/auth/logout`

```json
{ "refresh_token": "..." }
```

Revokes the refresh token (idempotent). Access tokens expire naturally (short TTL).

## User profile management

All `/api/v1/users/me*` endpoints require `Authorization: Bearer <access_token>`.

### Get profile

`GET /api/v1/users/me`

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "...",
    "full_name": "Vishnu",
    "email": "user@example.com",
    "avatar_url": null,
    "created_at": "2026-11-11T10:00:00+00:00"
  }
}
```

### Update profile

`PATCH /api/v1/users/me` — partial update of `full_name` and/or `email` (`extra` fields forbidden). Duplicate email → **409**.

### Avatar upload / replace

`POST /api/v1/users/me/avatar` — `multipart/form-data` field `file`.

- Allowed: JPEG, PNG, WebP (validated + re-encoded with Pillow; extension/Content-Type alone is not trusted)
- Max size: **2 MB** (`MAX_AVATAR_BYTES`)
- Stored under `backend/uploads/avatars/<user_id>/<uuid>.<ext>`
- Served at `/uploads/...`
- Replacing an avatar deletes the previous locally managed file after a successful save

### Delete avatar

`DELETE /api/v1/users/me/avatar` — clears `avatar_path` and deletes the managed file (idempotent if none).

### Change password

`PATCH /api/v1/users/me/password`

```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

On success, **all refresh tokens** for the user are revoked. Existing access tokens remain valid until they expire.

### User settings

`GET /api/v1/users/me/settings`  
`PATCH /api/v1/users/me/settings`

Supported fields (matches `user_settings` / frontend streak goal target + Stage 10 reminder prefs):

```json
{
  "streak_goal_target": 21,
  "notifications_enabled": true,
  "remind_habits_daily": true,
  "remind_habits_weekly": true,
  "remind_habits_upcoming": true,
  "remind_habits_overdue": true,
  "remind_goal_deadlines": true,
  "remind_streak_milestones": true,
  "remind_weekly_summary": true
}
```

`streak_goal_target` range: 1–365. Reminder flags default to `true`. Unknown preference keys are rejected.

## Habit management

All `/api/v1/habits*` endpoints require `Authorization: Bearer <access_token>`. Habits are always scoped to the authenticated user.

Field mapping (frontend `normalizeHabit` ↔ SQLite):

| API / frontend | DB column |
|----------------|-----------|
| `name`, `description`, `notes`, `icon`, `category` | same |
| `frequency` (`Daily` \| `Weekly`) | `frequency` |
| `start_date` (`YYYY-MM-DD`) | `start_date` |
| `week_day` (0=Sun … 6=Sat, Weekly only) | `week_day` |
| `is_archived` / `is_active` | `archived` (0/1) |

Categories: `Health`, `Work`, `Learning`, `Productivity`, `Mental Health`.

### Create

`POST /api/v1/habits` → **201**

```json
{
  "name": "Morning Workout",
  "description": "30 minutes cardio",
  "category": "Health",
  "frequency": "Daily",
  "start_date": "2026-11-01"
}
```

### List (search / filter / pagination)

`GET /api/v1/habits`

Query params:

- `status` — `active` | `archived` | `all` (default `all`)
- `category` — exact category
- `frequency` — `Daily` or `Weekly`
- `search` — case-insensitive name search
- `page`, `page_size` (max 100)

Response `data` includes `items`, `total`, `page`, `page_size`.

### Get / update

`GET /api/v1/habits/{habit_id}`  
`PATCH /api/v1/habits/{habit_id}` — partial update; unknown fields rejected.

### Delete (safe)

`DELETE /api/v1/habits/{habit_id}`

- No history → hard delete (`action: "deleted"`)
- Has check-ins / linked goals / journal entries → **archives** instead (`action: "archived"`) to preserve history

### Archive / restore

`PATCH /api/v1/habits/{habit_id}/archive`  
`PATCH /api/v1/habits/{habit_id}/restore`

Already-archived / not-archived conflicts return **409**.

## Habit check-ins

All check-in routes require authentication and habit ownership.

DB mapping: API `status` `completed`/`incomplete` ↔ `habit_checkins.completed` `1`/`0`. Unique on `(habit_id, date)`.

| Method | Path |
|--------|------|
| POST | `/api/v1/habits/{habit_id}/checkins` |
| GET | `/api/v1/habits/{habit_id}/checkins` |
| GET | `/api/v1/habits/{habit_id}/checkins/{date}` |
| PATCH | `/api/v1/habits/{habit_id}/checkins/{checkin_id}` |
| DELETE | `/api/v1/habits/{habit_id}/checkins/{checkin_id}` |

Create rules: habit not archived; `date >= start_date`; habit scheduled that day (Daily every day; Weekly only `week_day`, Sun=0…Sat=6). Duplicates → **409**.

```json
{
  "date": "2026-11-11",
  "status": "completed",
  "notes": "Completed my morning workout."
}
```

## Calendar

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/calendar/monthly?month=&year=` | Per-day totals + journal/notes flags |
| GET | `/api/v1/calendar/daily?date=` | Scheduled habits + status for one day |
| GET | `/api/v1/calendar/summary?start_date=&end_date=` | Range totals, trend, best day |
| GET/POST | `/api/v1/calendar/notes` | Day notes (one per user/date) |
| PATCH/DELETE | `/api/v1/calendar/notes/{note_id}` | Update / delete note |

Day habit statuses: `completed` | `pending` | `missed` | `not_scheduled`.  
Future and today incomplete → **pending** (never missed). Past incomplete → **missed**. Unscheduled days do not count. Archived habits are excluded from scheduling.

Dates are `YYYY-MM-DD` calendar keys (no timezone shifting).

Streak helpers live in `app/utils/streak_calculations.py` (used by analytics).

## Analytics

All `/api/v1/analytics*` routes require authentication. Values are **calculated** from habits + check-ins using Stage 6 scheduling/streak rules (no analytics tables).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/analytics/overview` | Dashboard totals, today, overall %, streaks |
| GET | `/api/v1/analytics/habits/{habit_id}` | Per-habit stats (`start_date`/`end_date` optional) |
| GET | `/api/v1/analytics/weekly` | Mon–Sun week (`date` optional anchor) |
| GET | `/api/v1/analytics/monthly` | Month grid (`month`, `year`) |
| GET | `/api/v1/analytics/categories` | Category breakdown (optional range) |
| GET | `/api/v1/analytics/best-days` | Weekday ranking by completion % |
| GET | `/api/v1/analytics/streaks` | Overall + per-habit streaks |

Rules: future/today incomplete → pending; past incomplete → missed; unscheduled ignored; archived habits excluded from active aggregates; empty datasets return zeros.

## Goals

All `/api/v1/goals*` routes require authentication and are scoped to the current user. Progress and status are **computed** (not stored columns) from linked habit check-ins using Stage 6 scheduling rules.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/goals` | Create goal |
| GET | `/api/v1/goals` | List (`status`, `category`, `archived`, `page`, `page_size`) |
| GET | `/api/v1/goals/summary` | Totals + non-archived goals |
| GET | `/api/v1/goals/{goal_id}` | Get one goal with progress |
| PATCH | `/api/v1/goals/{goal_id}` | Partial update (`clear_linked_habit` clears the link) |
| DELETE | `/api/v1/goals/{goal_id}` | Hard-delete goal row |

Target types: `completion_count` \| `consecutive_days` \| `days_completed` \| `completion_percentage`.  
Statuses: `archived` \| `completed` \| `overdue` \| `not_started` \| `in_progress`.  
`linked_habit_id` is optional and must belong to the authenticated user. Meeting the target sets `completed_at` (first completion date preserved).

## Achievements

Catalogue mirrors the frontend `ACHIEVEMENT_DEFS` (8 badges) in `app/achievements/catalogue.py`. Earned rows live in `user_achievements` with unique `(user_id, achievement_id)`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/achievements` | List earned achievements |
| GET | `/api/v1/achievements/summary` | Counts + full catalogue with earned flags |
| GET | `/api/v1/achievements/{achievement_id}` | Get one earned achievement |

Evaluation runs after successful habit check-in create/update and after goal create/update. Duplicate awards are prevented; original `unlocked_at` is preserved.

## Journal

All `/api/v1/journal*` routes require authentication and are scoped to the current user. Journal entries are **separate** from calendar `day_notes`. Calendar `has_journal` is derived from `journal_entries.date`.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/journal` | Create entry |
| GET | `/api/v1/journal` | List with filters + pagination |
| GET | `/api/v1/journal/summary` | Stats / streaks / period overview |
| GET | `/api/v1/journal/{entry_id}` | Get one entry |
| PATCH | `/api/v1/journal/{entry_id}` | Partial update (tags replace-set; `clear_habit`) |
| DELETE | `/api/v1/journal/{entry_id}` | Delete entry (+ tags cascade) |

List query params: `search`, `start_date`, `end_date`, `mood`, `tag`, `habit_id` (`general` = unlinked), `sort` (`newest`\|`oldest`), `page`, `page_size`.  
Summary: `period` = `thisWeek`\|`thisMonth`\|`lastMonth`\|`thisYear`.

Moods: `happy`, `productive`, `motivated`, `neutral`, `tired`, `stressed`, `sad`.  
Tags: `Productivity`, `Health`, `Learning`, `Personal Growth`, `Motivation`, `Reflection`.  
Optional `habit_id` must belong to the authenticated user. Updates preserve `created_at`.

## Notifications & reminders

In-app inbox only (no email/push). Generation is **idempotent** via unique `(user_id, dedupe_key)` and reuses Stage 6 schedule + goal/streak helpers. List endpoints can refresh (`refresh=true` by default on list).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/notifications` | Inbox (`unread_only`, `type`, `refresh`, pagination) |
| GET | `/api/v1/notifications/summary` | `{ total, unread }` |
| GET | `/api/v1/notifications/{id}` | Get one |
| PATCH | `/api/v1/notifications/{id}/read` | Mark one read |
| POST | `/api/v1/notifications/read-all` | Mark all read |
| DELETE | `/api/v1/notifications/{id}` | Dismiss |
| POST | `/api/v1/notifications/generate` | Force regenerate for current user |

Types include: `habit_daily_reminder`, `habit_weekly_reminder`, `habit_upcoming`, `habit_overdue`, `goal_deadline`, `goal_overdue`, `streak_milestone`, `weekly_summary`.

Optional background scheduler (disabled by default): `NOTIFICATIONS_SCHEDULER_ENABLED`, `NOTIFICATIONS_SCHEDULER_INTERVAL_SECONDS` in `.env`.

Additive migration: `c3f9a1b2d4e5_add_notifications_and_prefs`.

## Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |

## Testing

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Get-Location).Path
python -m pytest tests\test_auth.py -v
python -m pytest tests\test_users.py -v
python -m pytest tests\test_habits.py -v
python -m pytest tests\test_checkins.py -v
python -m pytest tests\test_calendar.py -v
python -m pytest tests\test_analytics.py -v
python -m pytest tests\test_goals.py -v
python -m pytest tests\test_achievements.py -v
python -m pytest tests\test_journal.py -v
python -m pytest tests\test_notifications.py -v
python -m pytest tests\test_notifications_migration.py -v
python -m pytest tests/ -v
```

Tests use an **in-memory SQLite** database and a temporary uploads directory — they never touch `habit_hero.db` or production avatar files. Migration tests use a separate temp SQLite via `ALEMBIC_DATABASE_URL`.

## API documentation (Swagger)

With the server running:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc
- OpenAPI JSON: http://127.0.0.1:8000/openapi.json

Tags: **auth**, **users**, **habits**, **checkins**, **calendar**, **analytics**, **goals**, **achievements**, **journal**, **notifications**, **health**. Use **Authorize** with a Bearer access token for protected routes.

## Project layout

```
backend/
  app/
    main.py
    core/          # config, security (password + JWT), optional scheduler
    db/            # engine, session, Base
    models/        # SQLAlchemy models
    schemas/       # Pydantic schemas
    services/      # … + notification_service, notification_generator
    achievements/  # ACHIEVEMENT_DEFS catalogue
    utils/         # schedule, date keys, streak helpers
    api/v1/        # routers / endpoints
    api/deps.py    # get_current_user, etc.
  uploads/avatars/ # profile images (gitignored)
  alembic/         # migrations
  tests/           # pytest suite
  schema/          # reference SQL DDL
  docs/            # architecture docs
  habit_hero.db    # created by Alembic
  requirements.txt
  .env.example
```

## Notes

- Phase 8 Stage 10: Notifications & Reminders complete (frontend integration not started until approved).
- Frontend is not modified in this phase.
- Stage 10 adds `notifications` + settings preference columns (additive Alembic only).
- MySQL / PostgreSQL are not used.
