# Habit Hero – Phase 8 Stages 7–9 Implementation Plan

**Status:** Stages 7–9 complete · frontend integration awaiting approval  
**Baseline:** Stages 1–9 · **136** pytest cases passing (after Stage 9)  
**Database:** `backend/habit_hero.db` (SQLite) · **no new tables expected**

---

## 1. Existing architecture (reuse)

```
app/
  api/v1/endpoints/   # auth, users, habits, checkins, calendar, analytics,
                      # goals, achievements, journal, health
  services/           # … + analytics, goal, achievement, journal
  achievements/       # ACHIEVEMENT_DEFS catalogue (8 badges)
  models/             # User, Habit, HabitCheckin, Goal, DayNote,
                      # JournalEntry, JournalEntryTag, UserAchievement, …
  schemas/
  utils/              # date_keys, habit_schedule, streak_calculations
tests/                # … + test_analytics, test_goals, test_achievements, test_journal
```

**Auth:** every new route uses `get_current_user()`; never trust client `user_id`.

**Scheduling / completion (Stage 6 – source of truth):**

| Rule | Behavior |
|------|----------|
| Daily | Every day from `start_date` |
| Weekly | Only `week_day` (Sun=0 … Sat=6) |
| Archived | Excluded from new/future scheduling |
| Future incomplete | `pending` (never `missed`) |
| Past incomplete | `missed` |
| Unscheduled | Not counted |
| % | `completed / scheduled × 100` (0 if denominator 0) |

Reuse: `habit_schedule.py`, `date_keys.py`, `streak_calculations.py`, `calendar_service` patterns.

---

## 2. Existing tables to reuse (no duplicates)

| Table | Stage | Notes |
|-------|-------|--------|
| `habits` / `habit_checkins` | 7 | Analytics source |
| `goals` | 8 | Full CRUD + progress |
| `user_achievements` | 8 | Earned badges; catalogue in code |
| `journal_entries` / `journal_entry_tags` | 9 | Journal CRUD |
| `day_notes` | 6/9 | Calendar notes ≠ journal entries |

**Migration expectation:** **none** for Stages 7–9 unless a verified gap appears. Models already match schema.

---

## 3. Frontend → backend field mapping

### 3.1 Analytics (frontend: `analyticsCalculations.js`, Analytics page)

Frontend computes locally from habits + check-ins. Backend APIs should expose equivalent aggregates.

| Frontend concept | Backend approach |
|------------------|------------------|
| Date presets / range | Query `start_date`/`end_date` or week/month params |
| Period occurrence stats | Scheduled vs completed in range (past/today only for rates) |
| Category performance | `HABIT_CATEGORIES`: Health, Work, Learning, Productivity, Mental Health |
| Top habits / habit analytics | Per-habit scheduled/completed/missed/%/streaks |
| Best weekdays | Rank by completion %; skip weekdays with 0 scheduled |
| Streaks | Reuse `streak_calculations.py` (fully completed scheduled days; skip unscheduled) |
| Heatmap / insights | Derived from same day stats (optional extras inside overview/trends) |

### 3.2 Goals (frontend: `goalCalculations.js`, Goals page)

| Frontend | DB / API |
|----------|----------|
| `id` | `goals.id` (string UUID) |
| `name` | `name` |
| `description` | `description` |
| `category` | `category` (+ Personal Development) |
| `icon` | `icon` |
| `linkedHabitId` | `linked_habit_id` (nullable, SET NULL on habit delete) |
| `targetType` | `target_type`: `completion_count` \| `consecutive_days` \| `days_completed` \| `completion_percentage` |
| `targetValue` | `target_value` (≥ 1) |
| `startDate` / `endDate` | `start_date` / `end_date` (YYYY-MM-DD) |
| `createdAt` | `created_at` |
| `notes` | `notes` |
| `archived` | `archived` (0/1) |
| `completedAt` | `completed_at` |
| Progress / status | **Computed**, not stored columns |

**Derived statuses (frontend):** `archived` \| `completed` \| `overdue` \| `not_started` \| `in_progress`  
(No “paused” status in current frontend — do **not** invent one.)

**Progress rules:**

- Window: `[start_date, min(end_date, today)]`
- Prefer linked habit check-ins; `completion_percentage` without link uses overall period rate
- Cap progress at target; rate ≤ 100%
- Auto-set `completed_at` when target met (preserve first completion date)

### 3.3 Achievements (frontend: `ACHIEVEMENT_DEFS`)

Catalogue (code config, not a DB table):

| `achievement_id` | Title | Trigger (summary) |
|------------------|-------|-------------------|
| `first_goal_completed` | First Goal Completed | ≥1 completed goal |
| `streak_7` / `12` / `15` / `30` | N-Day Streak | current or longest ≥ N |
| `five_goals_completed` | Five Goals Completed | ≥5 completed goals |
| `completion_milestone_50` | Goal Completion Milestone | overall goal completion rate ≥ 50% |
| `personal_best_streak` | Personal Best Streak | current ≥ longest and longest ≥ 3 |

DB row: `user_achievements` (`achievement_id`, `title`, `body`, `icon`, `unlocked_at`) with unique `(user_id, achievement_id)`.

Evaluate after check-in create/update and goal completion; never duplicate awards.

### 3.4 Journal (frontend: `journalCalculations.js`)

| Frontend | DB / API |
|----------|----------|
| `id` | `journal_entries.id` |
| `date` | `date` |
| `habitId` | `habit_id` (optional; must own habit) |
| `title` | `title` |
| `content` | `content` (required non-empty after trim) |
| `mood` | `mood` enum: happy, productive, motivated, neutral, tired, stressed, sad |
| `tags[]` | `journal_entry_tags.tag` (known tags preferred; unique per entry) |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` |

**Known tags:** Productivity, Health, Learning, Personal Growth, Motivation, Reflection  

**Separate from:** `day_notes` (calendar one-note-per-day). Calendar already exposes `has_journal` via Stage 6.

---

## 4. Stage 7 – Analytics APIs

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/analytics/overview` | Dashboard totals + today + overall streaks |
| GET | `/api/v1/analytics/habits/{habit_id}` | Single-habit analytics |
| GET | `/api/v1/analytics/weekly` | Week (optional `date` anchor) |
| GET | `/api/v1/analytics/monthly` | `month` + `year` |
| GET | `/api/v1/analytics/categories` | Category breakdown (optional range) |
| GET | `/api/v1/analytics/best-days` | Weekday ranking |
| GET | `/api/v1/analytics/streaks` | Overall + per-habit streaks |

Optional shared query: `start_date` / `end_date` where range-scoped.

### Files

- `app/schemas/analytics.py`
- `app/services/analytics_service.py` (reuse schedule + streak + check-in maps)
- `app/api/v1/endpoints/analytics.py`
- `tests/test_analytics.py`

### DB changes

**None.**

### Security / validation

- User-scoped habits only
- 404 for other users’ habit IDs
- Invalid month/year/date → 400/422
- Empty datasets → zeros, not errors

### Tests (Stage 7)

Empty data · daily/weekly · % · weekly/monthly · leap year · categories · best days · streaks · archived · future · isolation · full regression (93+)

### Exit criteria

Stage 7 tests green + full `pytest tests/` green + Swagger + README before Stage 8.

---

## 5. Stage 8 – Goals & Achievements APIs

### Goals endpoints

| Method | Path |
|--------|------|
| POST | `/api/v1/goals` |
| GET | `/api/v1/goals` (filters: status, category, archived, pagination) |
| GET | `/api/v1/goals/summary` |
| GET | `/api/v1/goals/{goal_id}` |
| PATCH | `/api/v1/goals/{goal_id}` |
| DELETE | `/api/v1/goals/{goal_id}` |

Delete: hard-delete goal row (no check-in cascade). Habit FK already `ON DELETE SET NULL` from habit side.

### Achievements endpoints

| Method | Path |
|--------|------|
| GET | `/api/v1/achievements` |
| GET | `/api/v1/achievements/summary` |
| GET | `/api/v1/achievements/{achievement_id}` |

Plus internal `achievement_service.evaluate_and_award(user)` called from check-in/goal flows with minimal hooks (import service; avoid rewriting Stage 5/6).

### Files

- `app/schemas/goal.py`, `app/schemas/achievement.py`
- `app/services/goal_service.py`, `app/services/achievement_service.py`
- `app/api/v1/endpoints/goals.py`, `achievements.py`
- `app/achievements/catalogue.py` (or config inside achievement_service) mirroring `ACHIEVEMENT_DEFS`
- `tests/test_goals.py`, `tests/test_achievements.py`
- Small hooks in `checkin_service` / `goal_service` only

### DB changes

**None** expected.

### Tests (Stage 8)

CRUD · progress types · completion · overdue · invalid targets · linked habit ownership · award + duplicate prevention · streak/goal achievements · isolation · regression

### Exit criteria

Stage 8 tests + full regression + Swagger + README before Stage 9.

**Stage 8 result:** Implemented · `tests/test_goals.py` + `tests/test_achievements.py` green · full suite **126** passing · no migrations · Swagger tags `goals` / `achievements` · README updated.

---

## 6. Stage 9 – Journal APIs

### Endpoints

| Method | Path |
|--------|------|
| POST | `/api/v1/journal` |
| GET | `/api/v1/journal` (page, search, date range, mood, tag, habit_id, sort) |
| GET | `/api/v1/journal/summary` |
| GET | `/api/v1/journal/{entry_id}` |
| PATCH | `/api/v1/journal/{entry_id}` |
| DELETE | `/api/v1/journal/{entry_id}` |

Tags: replace-set on update; unique `(journal_entry_id, tag)`; cascade delete with entry.

### Files

- `app/schemas/journal.py`
- `app/services/journal_service.py`
- `app/api/v1/endpoints/journal.py`
- `tests/test_journal.py`

### DB changes

**None.** Calendar `has_journal` already works via `journal_entries.date`.

### Tests (Stage 9)

CRUD · search · filters · pagination · tags · mood · habit ownership · isolation · calendar indicator · regression

### Exit criteria

Stage 9 tests + **full** `pytest tests/ -v` green + Swagger + README + final validation checklist.

**Stage 9 result:** Implemented · `tests/test_journal.py` green · full suite **136** passing · no migrations · Swagger tag `journal` · README updated · calendar `has_journal` unchanged / separate from `day_notes`.

---

## 7. Cross-cutting concerns

### Response shape

```json
{ "success": true, "message": "...", "data": { } }
```

### Dependencies between stages

```
Stage 6 (schedule/checkins/calendar)
    └── Stage 7 Analytics (read-only aggregates)
Stage 5–6 + Goals model
    └── Stage 8 Goals progress + Achievements (hooks on check-in/goal)
Stage 6 day_notes ≠ Stage 9 journal
    └── Stage 9 Journal (optional habit_id; calendar indicator already exists)
```

### Potential conflicts / risks

| Risk | Mitigation |
|------|------------|
| Streak semantics vs frontend 80% “successful day” | Backend Stage 6 streak = all scheduled completed; document difference; align Analytics with Stage 6 utilities |
| Route ordering (`/goals/summary` vs `/{id}`) | Register static paths before `{id}` |
| Achievement hooks slowing check-ins | Keep evaluation O(catalogue); unique constraint prevents dupes |
| Journal tags free-text vs catalogue | Prefer frontend `JOURNAL_TAGS`; allow validated subset |
| N+1 | Batch load habits/checkins/maps like calendar_service |

### Security

- JWT on all new routes
- Ownership on every ID
- No password/hash/token leakage
- No mass-assignment of `user_id` / `completed_at` abuse without rules

---

## 8. Testing strategy

| Suite | File | When |
|-------|------|------|
| Analytics | `tests/test_analytics.py` | After Stage 7 |
| Goals | `tests/test_goals.py` | After Stage 8 |
| Achievements | `tests/test_achievements.py` | After Stage 8 |
| Journal | `tests/test_journal.py` | After Stage 9 |
| Regression | `pytest tests/` | After **each** stage |

Fixtures: existing `conftest.py` in-memory SQLite + temp uploads. Never touch `habit_hero.db` in tests.

---

## 9. Documentation updates (per stage)

- Append endpoint sections to `backend/README.md` (do not wipe prior stages)
- Mark stage complete in this plan after tests pass
- Swagger: http://127.0.0.1:8000/docs

---

## 10. Execution checklist

| Step | Action | Status |
|------|--------|--------|
| A | Full project inspection | **Done** |
| B | This implementation plan | **Done – awaiting review** |
| C | Stage 7 Analytics + tests + regression | **Complete** |
| D | Stage 8 Goals & Achievements + tests + regression | **Complete** |
| E | Stage 9 Journal + tests + full regression + final report | **Complete** |

---

## 11. Explicit non-goals

- No frontend changes / Phase 9 React integration
- No MySQL/PostgreSQL
- No analytics fact tables
- No inventing paused goals or unsupported moods
- No rewriting Stages 3–6 modules beyond tiny achievement hooks
- No destructive DB resets

---

**Next action:** Stages 7–10 complete. Frontend integration not started — wait for explicit approval. Stage 10 details: `docs/PHASE_8_STAGE_10_IMPLEMENTATION_PLAN.md`.
