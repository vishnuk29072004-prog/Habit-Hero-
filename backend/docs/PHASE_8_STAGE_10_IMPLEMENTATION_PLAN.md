# Habit Hero – Phase 8 Stage 10 Implementation Plan  
## Notifications & Reminders

**Status:** **Complete** (implemented after plan approval)  
**Baseline after Stage 10:** **149** pytest cases passing (prior **136** preserved + Stage 10 tests)  
**Database:** `backend/habit_hero.db` (SQLite) · revision `c3f9a1b2d4e5`  
**Constraint:** No frontend changes in Stage 10 · no email/push providers · minimize new dependencies

---

## 1. Architecture review summary (pre–Stage 10)

### 1.1 What exists today

| Area | Current state |
|------|----------------|
| Auth / ownership | JWT `get_current_user`; all domain APIs scoped by `user_id` |
| Habits / schedule | `habit_schedule.is_habit_scheduled_on_date` (Daily / Weekly `week_day`) |
| Check-ins / calendar | Pending vs missed rules; streaks in `streak_calculations` |
| Goals | Derived statuses: `archived` \| `completed` \| `overdue` \| `not_started` \| `in_progress` |
| Achievements | Event-driven after check-in / goal (in-process hooks) |
| Journal / day notes | Separate tables; calendar `has_journal` / `has_notes` |
| `user_settings` | **Only** `streak_goal_target` (1–365) + `updated_at` |
| Notifications DB | **None** — no `notifications` table in schema/models |
| Background jobs | **None** — no Celery/Redis/APScheduler; no FastAPI lifespan workers |
| Dependencies | FastAPI, SQLAlchemy, Alembic, JWT, Pillow, pytest — lean stack |

### 1.2 Frontend notification surface (read-only inspection)

`PageHeaderTools` uses **mock** data from `mockData.js`:

| Field | Mock shape | Implication for API |
|-------|------------|---------------------|
| `id` | string | Persist string UUID or int PK exposed as string/int |
| `title` | short label | e.g. “Habit reminder”, “Streak milestone” |
| `message` | body text | Human-readable detail |
| `time` | relative (“2h ago”) | Prefer store ISO `created_at`; client can format (API may also return relative helper later) |
| `unread` | boolean | Persist `read_at` null/non-null |
| Mark all read | local state only | Needs `PATCH …/read-all` (or equivalent) |

**Settings UI:** no notification preference controls yet (account/data only).  
**Habits/goals:** no per-habit reminder clock times in models or UI.  
**Streak target:** frontend `goalTarget` / `nextGoalTarget` maps to `user_settings.streak_goal_target` (already Stage 3).

Mock notification *types* implied by copy:

1. Streak milestone (approaching / related to streak goal)
2. Habit reminder (pending habits today)
3. Weekly summary (consistency nudge)

Plus requested Stage 10 themes: daily/weekly habit reminders, upcoming, overdue, goal deadlines, preferences, history/read state.

### 1.3 Gaps that force schema work

Unlike Stages 7–9 (reuse-only tables), Stage 10 **cannot** store notification history or preferences without schema changes:

- No place for unread/read history
- `user_settings` rejects unknown keys today (`notifications_enabled` → 422 in tests)
- Deduplication requires a durable unique key

**Conclusion:** Stage 10 is the first stage that **expects a focused Alembic migration** (notifications + settings preference columns). No Redis/email/push packages.

---

## 2. Design principles

1. **In-app inbox only** — no SMTP, FCM, APNs, or third-party push unless a later phase explicitly requires it.
2. **User-scoped** — every row tied to `user_id`; never cross-user.
3. **Idempotent generation** — unique constraint prevents duplicate reminders for the same logical event/day.
4. **Reuse scheduling & goal logic** — call `habit_schedule`, calendar pending/missed semantics, `goal_service` / `compute_goal_status`; do not reimplement.
5. **Preference-gated** — generation respects user toggles (defaults on for core reminders).
6. **Preserve Stages 1–9** — no behavior change to habits/check-ins/goals/journal except optional thin hooks if needed.
7. **Lean runtime** — prefer stdlib `asyncio` lifespan loop over Celery; add a scheduler library only if lifespan proves insufficient.

---

## 3. Proposed data model

### 3.1 Extend `user_settings` (preference columns)

Add boolean (0/1) flags — names illustrative; finalize in implementation:

| Column | Default | Purpose |
|--------|---------|---------|
| `notifications_enabled` | 1 | Master switch |
| `remind_habits_daily` | 1 | Today’s pending scheduled habits |
| `remind_habits_weekly` | 1 | Weekly habits due this week / on scheduled weekday |
| `remind_habits_upcoming` | 1 | Habits scheduled in near window (e.g. tomorrow) |
| `remind_habits_overdue` | 1 | Past scheduled incomplete (missed) |
| `remind_goal_deadlines` | 1 | Goals nearing `end_date` or already `overdue` |
| `remind_streak_milestones` | 1 | Approaching `streak_goal_target` |
| `remind_weekly_summary` | 1 | Optional weekly rollup notification |

Optional later (only if needed): `quiet_hours_start` / `quiet_hours_end` — **out of v1** unless approved (frontend has no time pickers).

Extend `GET/PATCH /api/v1/users/me/settings` to accept these fields (keep `streak_goal_target`).

### 3.2 New table `notifications`

```
notifications
  id              TEXT PK (UUID)
  user_id         TEXT NOT NULL FK users ON DELETE CASCADE
  type            TEXT NOT NULL   -- enum string
  title           TEXT NOT NULL
  message         TEXT NOT NULL
  resource_type   TEXT NULL      -- habit | goal | streak | system
  resource_id     TEXT NULL
  dedupe_key      TEXT NOT NULL   -- stable idempotency key
  created_at      TEXT NOT NULL   -- ISO UTC
  read_at         TEXT NULL       -- ISO UTC when read
  UNIQUE (user_id, dedupe_key)
  INDEX (user_id, created_at DESC)
  INDEX (user_id, read_at)
```

**Suggested `type` values:**

| type | Source |
|------|--------|
| `habit_daily_reminder` | Scheduled today, incomplete |
| `habit_weekly_reminder` | Weekly habit due today / this week incomplete |
| `habit_upcoming` | Scheduled within upcoming window (e.g. tomorrow) |
| `habit_overdue` | Past scheduled day incomplete (missed) |
| `goal_deadline` | Goal within N days of `end_date`, not completed |
| `goal_overdue` | Goal status `overdue` |
| `streak_milestone` | Current streak approaches / hits `streak_goal_target` |
| `weekly_summary` | Once per ISO week rollup |

**Dedupe key examples:**

- `habit_daily:{habit_id}:{date}`
- `goal_overdue:{goal_id}:{end_date}`
- `streak_milestone:{target}:{as_of_date}`
- `weekly_summary:{yyyy-Www}`

Re-running the generator must **no-op** when the key exists (preserve original `created_at` / `read_at`).

### 3.3 Migration policy

- One Alembic revision + update `schema/habit_hero_schema.sql` reference DDL.
- No destructive resets; additive columns/tables only.
- Tests continue on isolated in-memory SQLite via `Base.metadata.create_all`.

---

## 4. Generation engine (core service)

### 4.1 Module layout (planned)

```
app/services/notification_service.py   # CRUD + mark read
app/services/notification_generator.py # evaluate habits/goals → upsert
app/schemas/notification.py
app/models/notification.py
app/api/v1/endpoints/notifications.py
app/core/scheduler.py                  # optional lifespan loop
tests/test_notifications.py
```

### 4.2 Evaluation rules (reuse existing semantics)

| Feature | Rule (align with Stage 6) |
|---------|---------------------------|
| Daily habit reminder | Active habit scheduled **today**, no completed check-in → pending |
| Weekly habit reminder | Weekly + scheduled today (or “due this week incomplete” if product chooses today-only for v1) |
| Upcoming | Scheduled on `today+1` (configurable window 1 day in v1) |
| Overdue habit | Scheduled on a **past** date, incomplete → missed (not future; not today-as-missed) |
| Goal deadline | Not archived/completed; `end_date` within next **3 days** (configurable constant) |
| Goal overdue | `compute_goal_status` == `overdue` |
| Streak milestone | `get_current_streak` within **2 days** of `streak_goal_target`, or exactly at target |
| Weekly summary | At most one per user per week; message uses weekly completion % from analytics helpers if cheap |

Archived habits excluded from new reminders (same as calendar active scheduling).

### 4.3 When generation runs

**Recommended hybrid (no Celery):**

1. **On read refresh** — `GET /notifications?refresh=true` (default `true` or explicit) runs generator for **current user** only (cheap, request-scoped).
2. **Optional lifespan loop** — FastAPI `lifespan` asyncio task every N minutes (e.g. 15) iterates users with `notifications_enabled` and generates. Suitable for single-process uvicorn.
3. **Manual admin/dev** — `POST /api/v1/notifications/generate` (auth user self-only) for tests/Swagger.

**Not in v1:** multi-worker distributed locks, Redis queues, OS cron dependency (document as optional ops later).

**Duplicate safety:** unique `(user_id, dedupe_key)` + catch `IntegrityError`.

### 4.4 Scheduling approach decision

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| Lazy generate on GET | No new deps; simple | Only when user opens app | **Primary** |
| Lifespan asyncio loop | Near-real-time while server up | Stops if process down; multi-worker duplicates mitigated by dedupe | **Secondary** |
| APScheduler | Familiar cron API | New dependency | Only if lifespan insufficient |
| Celery/RQ | Heavy | Redis + workers | **Reject** for Stage 10 |

---

## 5. API surface (proposed)

All routes: `Authorization: Bearer` · tag `notifications`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/notifications` | List inbox (`unread_only`, `type`, `page`, `page_size`, optional `refresh`) |
| GET | `/api/v1/notifications/summary` | `{ total, unread }` (+ optional breakdown by type) |
| GET | `/api/v1/notifications/{id}` | Single item (owned) |
| PATCH | `/api/v1/notifications/{id}/read` | Mark one read |
| POST | `/api/v1/notifications/read-all` | Mark all read for user |
| DELETE | `/api/v1/notifications/{id}` | Optional dismiss/delete |
| POST | `/api/v1/notifications/generate` | Force regenerate for current user |
| GET/PATCH | `/api/v1/users/me/settings` | Extended with reminder preference flags |

**Response item (maps to frontend mock):**

```json
{
  "id": "...",
  "type": "habit_daily_reminder",
  "title": "Habit reminder",
  "message": "Morning Workout is still pending for today.",
  "resource_type": "habit",
  "resource_id": "...",
  "unread": true,
  "created_at": "2026-11-11T10:00:00+00:00",
  "read_at": null
}
```

`unread` = `read_at is null`. Relative `time` left to clients (or thin computed field later — not required for v1).

---

## 6. Security & ownership

- All queries filter `Notification.user_id == current_user.id`.
- Generator never creates rows for other users.
- Settings PATCH cannot set another user’s prefs.
- No mass-assignment of `user_id` / `dedupe_key` from clients.
- Do not expose other users’ habit/goal names via notification messages outside ownership (messages built server-side from owned rows only).

---

## 7. Explicit non-goals (Stage 10)

- Frontend wiring / replacing mock `PageHeaderTools` data
- Email, SMS, web push, mobile push
- Per-habit custom reminder clock times (no UI/schema today)
- Quiet hours / timezone-aware local clocks beyond date-key semantics (stick to `YYYY-MM-DD` + UTC `created_at` like rest of API)
- Rewriting Stages 3–9 modules beyond settings schema extension + thin generate hooks
- Celery/Redis/MySQL/PostgreSQL

---

## 8. Testing plan

File: `tests/test_notifications.py` (+ settings preference cases in `test_users.py` or same file).

| Case | Expectation |
|------|-------------|
| Preferences defaults | New user gets master + reminder flags on |
| Preference off | Generator skips that category |
| Daily pending habit | Creates one `habit_daily_reminder`; second generate no duplicate |
| Weekly habit | Reminder only on scheduled weekday |
| Upcoming | Created for tomorrow-scheduled habit |
| Overdue habit | Past missed day → overdue type; today incomplete ≠ overdue |
| Goal deadline / overdue | Uses goal status helpers |
| Streak milestone | Uses streak utils + `streak_goal_target` |
| Mark read / read-all | `unread` flips; summary counts |
| Isolation | User B cannot list/read User A notifications |
| Auth | 401/403 without token |
| Regression | Full `pytest tests/` remains green (136 + new) |

Fixtures: existing in-memory SQLite `conftest.py` — never touch `habit_hero.db`.

---

## 9. Documentation / exit criteria

After implementation (post-approval):

1. Stage 10 tests green  
2. Full regression green (baseline **136** + new cases)  
3. Swagger tag `notifications` verified  
4. Update `README.md` (settings + notifications sections)  
5. Mark this plan **Complete** with test counts  
6. Update `PHASE_8_STAGES_7_8_9_IMPLEMENTATION_PLAN.md` checklist pointer if desired  

**Do not start frontend integration until separately approved.**

---

## 10. Implementation checklist (post-approval only)

| Step | Action | Status |
|------|--------|--------|
| 0 | This plan reviewed | **Approved** |
| 1 | Alembic migration: `notifications` + settings preference columns | **Done** (`c3f9a1b2d4e5`) |
| 2 | Models / schemas / settings API extension | **Done** |
| 3 | Generator + notification CRUD endpoints | **Done** |
| 4 | Optional lifespan scheduler | **Done** (off by default) |
| 5 | `tests/test_notifications.py` + migration + settings tests | **Done** |
| 6 | Full regression + Swagger + README | **Done** (149 passed) |
| 7 | Stop for approval before frontend / further stages | **Waiting** |

---

## 11. Risk register

| Risk | Mitigation |
|------|------------|
| Generator spam | Preference flags + dedupe keys + cap per type/day |
| Multi-worker double insert | Unique constraint |
| Lifespan stops when server down | Lazy refresh on GET still works |
| Overdue definition drift | Reuse calendar missed rules only |
| Settings test breakage | Update tests that expect unknown keys rejected; allow new known keys |
| Scope creep (email/push) | Explicit non-goals |

---

## 12. Baseline confirmation

```
pytest tests/  →  136 passed  (pre–Stage 10)
pytest tests/  →  149 passed  (post–Stage 10)
```

**Stage 10 result:** Additive migration · lazy generate + dedupe · settings prefs · optional lifespan scheduler · Swagger tag `notifications` · no Celery/email/push · no frontend changes.

---

**Next action:** Wait for explicit approval before frontend integration or any further stage.
