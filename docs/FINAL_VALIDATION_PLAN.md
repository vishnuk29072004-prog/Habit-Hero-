# Habit Hero – Final Validation Plan

**Document status:** Stages 1–3 complete · awaiting approval for Stage 4  
**Created:** 2026-11-11 · **Stage 3 executed:** 2026-11-11  
**Phases completed:** Backend Phase 8 (stages 1–10) · Frontend–Backend Phase 9 (steps A–J)  
**Backend auth suite (Stage 3):** **20/20** pytest · live smokes green  
**Constraint:** Validate only · **no application code changes** without explicit approval · do not reset `backend/habit_hero.db`

**Result legend**

| Status | Meaning |
|--------|---------|
| Pass | Relevant test executed and succeeded |
| Fail | Relevant test executed and failed |
| Not Tested | Planned; not yet executed in this final phase |
| Blocked | Cannot run until a dependency/blocker is resolved |

**Severity legend:** Critical · High · Medium · Low · Informational

---

## 1. Architecture summary

### 1.1 System shape

```
Browser (React / Vite)
  AuthContext  → JWT session (sessionStorage hydrate) → apiClient (axios)
  HabitContext → domain loaders/mutations (habits, check-ins, calendar notes,
                 goals, achievements, journal, notifications)
        │
        ▼
FastAPI  http://127.0.0.1:8000/api/v1
  Auth · Users · Habits · Check-ins · Calendar · Analytics
  Goals · Achievements · Journal · Notifications · Health
        │
        ▼
SQLite  backend/habit_hero.db  (+ Alembic migrations)
```

### 1.2 Frontend

| Area | Location | Notes |
|------|----------|-------|
| Entry / routing | `frontend/src/main.jsx`, `App.jsx` | React Router; `ProtectedRoute` + `MainLayout` |
| Auth | `AuthContext`, `authService`, `tokenStore` | Access + refresh JWTs; **sessionStorage** key `habit-hero-auth-session` |
| Domain state | `HabitContext.jsx` | API-backed; clears on logout / account switch |
| API layer | `services/api/*` | `apiClient` + module APIs + mappers |
| Pages | Dashboard, Habits, Calendar, Analytics, Goals, Journal, Settings, Profile, Login, Signup | `/progress` → redirect to `/calendar` |
| UI | Custom CSS + Lucide + Recharts | Premium layouts preserved |
| Env | `VITE_API_BASE_URL` | Default `http://127.0.0.1:8000/api/v1` |

### 1.3 Backend

| Area | Location | Notes |
|------|----------|-------|
| App | `app/main.py`, `app/api/v1/router.py` | Prefix `/api/v1` |
| Config | `app/core/config.py`, `.env` | SECRET_KEY, CORS, JWT TTLs, avatar limits, scheduler flag |
| ORM models | users, settings, habits, checkins, goals, day_notes, journal(+tags), achievements, notifications, refresh_tokens | |
| Migrations | Alembic: `e89d66e6c24e` → `2486eb757a7f` → `c3f9a1b2d4e5` | |
| Auth | bcrypt passwords; JWT access; hashed rotating refresh tokens | |
| Scheduler | `NOTIFICATIONS_SCHEDULER_ENABLED=false` (default) | Must stay off unless approved |

### 1.4 Startup commands (inspection)

**Backend**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = (Get-Location).Path
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend**

```powershell
cd frontend
npm install
npm run dev
```

**Swagger:** `http://127.0.0.1:8000/docs`

### 1.5 Known leftovers / technical debt (informational until validated)

| Item | Severity | Notes |
|------|----------|-------|
| No root `README.md` | Medium | Only `backend/README.md`; monorepo setup docs incomplete |
| Stub `frontend/src/services/api.js` | Low | Wrong base `/api`; unused by live contexts |
| `mockData.js` still imported | Medium | `STORAGE_KEY`, `completionGrowth`, `weeklyConsistencyGrowth`, `normalizeHabit` helpers; notifications seed unused by inbox |
| Legacy `habit-hero-data-v3` | Medium | Preserved, not source of truth; no auto-import |
| Client calc utils remain | Informational | Display helpers; analytics/goals/journal stats should be API-backed |
| Tokens in sessionStorage | Medium (security) | XSS-accessible; tab-scoped (not localStorage) |
| Default `SECRET_KEY=change-me-in-production` | High (prod) | Unsafe for any non-local deploy |
| SQLite as primary DB | High (prod) | Fine for demo; not multi-writer production |
| No React ErrorBoundary | Medium | Uncaught render errors can blank the app |
| No browser E2E suite | Medium | Coverage via pytest + smoke scripts + manual scenarios |
| Phase 9 plan header still mentions some pre-integration “today” wording in §1 | Low | Historical inspection section; Step results A–J are authoritative |

---

## 2. Module-by-module validation checklist

> Stages 4–10 remain **Not Tested** until approved and executed.

### 2.1 Authentication (Stage 3) — COMPLETE

| ID | Check | Method | Result | Evidence |
|----|-------|--------|--------|----------|
| A1 | New user registration | pytest + `verifyAuthIntegration` + `verifyFinalStage3Auth` + browser login | **PASS** | 201 register; dashboard greets user |
| A2 | Duplicate email → 409 | pytest + verifyAuthIntegration | **PASS** | status 409 |
| A3 | Invalid email rejected | pytest + verifyFinalStage3Auth | **PASS** | 422/400 |
| A4 | Weak password rejected | pytest + verifyFinalStage3Auth | **PASS** | 422/400 |
| A5 | Valid login | pytest + smokes + browser | **PASS** | token pair issued (not logged) |
| A6 | Invalid password | pytest + verifyAuthIntegration | **PASS** | 401 |
| A7 | Invalid email login | pytest + verifyFinalStage3Auth | **PASS** | 401 |
| A8 | Access token on API calls | pytest + smokes + browser /auth/me via session | **PASS** | Bearer accepted |
| A9 | Refresh token rotation | pytest + both smokes | **PASS** | new refresh ≠ old; reuse → 401 |
| A10 | Session restore after reload | Browser: login → navigate/reload `/` | **PASS** | `sessionStorage` present; Dashboard restored |
| A11 | Expired access token | pytest `test_expired_access_token` | **PASS** | expired JWT → 401; client refresh path in `apiClient.js` |
| A12 | Failed refresh clears session | API invalid/reused refresh 401 + code (`clearTokens` → `setOnTokensCleared`) + logout cleared sessionStorage | **PASS** | Frontend clears auth on token clear |
| A13 | Logout | pytest + smokes + browser Logout | **PASS** | refresh revoked; UI → `/login`; sessionStorage cleared |
| A14 | Protected routes | Browser `/` and `/habits` logged out → `/login`; API without token 403 | **PASS** | `ProtectedRoute` redirect |
| A15 | Account switching | Dual-user API + HabitContext clears when `!isAuthenticated` | **PASS** | distinct `/auth/me`; domain clear on logout |
| A16 | Session isolation | User B cannot list/get User A habit | **PASS** | empty list / 403|404 |

**Commands executed (Stage 3):**

```text
# Backend (isolated SQLite fixtures — does not wipe habit_hero.db)
cd backend
$env:PYTHONPATH = (Get-Location).Path
.\.venv\Scripts\python.exe -m pytest tests/test_auth.py -v --tb=short
# → 20 passed

# Live API smokes (dedicated ephemeral emails)
cd frontend
node scripts/verifyAuthIntegration.mjs          # 10 passed
node scripts/verifyFinalStage3Auth.mjs          # 18 passed

# Browser (localhost:5173)
# Login dedicated UI user → Dashboard → reload session → Logout → /habits redirects /login
```

**Security checks (Stage 3):**

| Check | Result | Notes |
|-------|--------|-------|
| Password hashed (bcrypt), not plaintext | **PASS** | pytest `test_password_stored_as_hash` |
| Responses omit password/password_hash | **PASS** | pytest + error payload smoke |
| Refresh stored hashed; rotation/revoke | **PASS** | pytest refresh/logout suite |
| Unauthorized rejected | **PASS** | Missing bearer → **403** (HTTPBearer); bad/expired JWT → **401** |
| Tokens/passwords not printed in reports/scripts output | **PASS** | Stage 3 scripts redact JWTs |

**Observation (not a Stage 3 failure):** Missing `Authorization` header on protected routes returns **403** rather than **401**. Backend tests already allow `(401, 403)`. Frontend treats both as unauthenticated. Severity: **Informational / Low** — optional consistency tweak only if approved later.

### 2.2 Profile & settings (Stage 4)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| P1 | Profile load | High | Not Tested |
| P2 | Profile update | High | Not Tested |
| P3 | Avatar upload | High | Not Tested |
| P4 | Avatar delete | Medium | Not Tested |
| P5 | Avatar after refresh | High | Not Tested |
| P6 | Avatar size limit (2 MB) | Medium | Not Tested |
| P7 | Invalid avatar file | Medium | Not Tested |
| P8 | Password change | High | Not Tested |
| P9 | Password validation | High | Not Tested |
| P10 | Reminder prefs persist | Medium | Not Tested |
| P11 | Settings persistence | Medium | Not Tested |
| P12 | Header/nav reflects profile | Medium | Not Tested |

### 2.3 Habits (Stage 5)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| H1–H14 | CRUD, archive/restore, daily/weekly, category, start date, weekday, empty/invalid/errors, ownership, persistence | Critical–High | Not Tested |

### 2.4 Check-ins & calendar (Stage 6)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| C1–C14 | Complete/incomplete, notes, month nav, daily summary, day notes CRUD, %, past/today/future, schedule rules (unscheduled ≠ missed; archived excluded) | Critical–High | Not Tested |

### 2.5 Dashboard & analytics (Stage 7)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| D1–D14 | Overview, weekly/monthly, streaks, categories, trends, best days, consistency, habit detail, ranges, heatmap, empty/loading/error; backend as source of truth | High | Not Tested |

### 2.6 Goals & achievements (Stage 8)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| G1–G14 | Goal CRUD, progress/status, link/clear habit, summary, catalogue, earned/locked, uniqueness, NextGoal; isolation | High–Critical | Not Tested |

### 2.7 Journal (Stage 9)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| J1–J16 | CRUD, filters, sort, pagination, summary, recent; enums; habit ownership; `has_journal` vs day_notes; no legacy import | High | Not Tested |

### 2.8 Notifications (Stage 10)

| ID | Check | Severity if fail | Status |
|----|-------|------------------|--------|
| N1–N14 | List/summary/unread, mark one/all, delete, pagination, empty/loading/retry, generate+dedupe, isolation; prefs intact; scheduler off; no push/email claim | High | Not Tested |

---

## 3. API integration validation checklist

| ID | Area | Status |
|----|------|--------|
| API1 | Auth endpoints envelope + status codes | Not Tested |
| API2 | Users/profile/avatar/settings | Not Tested |
| API3 | Habits + check-ins ownership | Not Tested |
| API4 | Calendar monthly/daily/summary + notes | Not Tested |
| API5 | Analytics endpoints | Not Tested |
| API6 | Goals + achievements | Not Tested |
| API7 | Journal filters/summary | Not Tested |
| API8 | Notifications list/summary/read/delete/generate | Not Tested |
| API9 | Health liveness | Not Tested |
| API10 | Pagination consistency | Not Tested |
| API11 | Error body `{ success, message, detail }` | Not Tested |

---

## 4. Authentication & security checklist

| ID | Check | Severity | Status |
|----|-------|----------|--------|
| S1 | Passwords bcrypt-only (no plaintext) | Critical | **PASS** (Stage 3) |
| S2 | JWT validation / expiry | Critical | **PASS** (Stage 3) |
| S3 | Refresh hash storage + rotation | Critical | **PASS** (Stage 3) |
| S4 | Logout invalidation | Critical | **PASS** (Stage 3) |
| S5 | Unauthorized rejected (401/403) | Critical | **PASS** (Stage 3; missing bearer → 403) |
| S6 | Cross-user resource access blocked | Critical | **PASS** (Stage 3 habit probe) |
| S7 | ID manipulation / ownership | Critical | Not Tested |
| S8 | Input validation (enums, dates, sizes) | High | Not Tested |
| S9 | Avatar upload validation | High | Not Tested |
| S10 | No hardcoded production secrets in repo defaults | High | Not Tested *(default SECRET_KEY in `.env.example` is a known risk for prod)* |
| S11 | CORS restricted to configured origins | High | Not Tested |
| S12 | Frontend token storage exposure documented | Medium | Not Tested |
| S13 | XSS-safe rendering of user content | Medium | Not Tested |
| S14 | Error messages do not leak secrets | Medium | Not Tested |
| S15 | Scheduler remains disabled | Medium | Not Tested |

---

## 5. Database & migration checklist

| ID | Check | Status |
|----|-------|--------|
| DB1 | Tables present for all models | Not Tested |
| DB2 | Alembic head applies on **temporary** SQLite | Not Tested |
| DB3 | FK constraints / cascades | Not Tested |
| DB4 | Unique constraints (email, tags, check-in date, achievements, notifications dedupe) | Not Tested |
| DB5 | Indexes justified | Not Tested |
| DB6 | `verify_db.py` on temp DB | Not Tested |
| DB7 | **No** reset/overwrite of `habit_hero.db` | Pass *(policy for this phase)* |

**Policy:** Migration/regression tests must use an isolated temporary database. Never delete or overwrite the development `habit_hero.db`.

---

## 6. Cross-module testing scenarios (Stage 11)

| Scenario | Description | Status |
|----------|-------------|--------|
| X1 | Habit → check-in → Dashboard / Analytics / Calendar / streak | Not Tested |
| X2 | Habit → linked goal → progress / status / achievements | Not Tested |
| X3 | Journal → calendar `has_journal` · day_notes independent | Not Tested |
| X4 | Notification generate → inbox → read/all/delete → summary | Not Tested |
| X5 | Account isolation User A ↔ User B | Not Tested |
| X6 | Browser refresh persistence · no duplicate records | Not Tested |

---

## 7. Frontend testing strategy

1. **Smoke scripts** (live API against running backend; register ephemeral users — do not wipe `habit_hero.db`):

| Script | Phase 9 last reported | Final phase |
|--------|----------------------|-------------|
| `scripts/verifyApiClient.mjs` | Prior | Not Tested |
| `scripts/verifyAuthIntegration.mjs` | Prior | Not Tested |
| `scripts/verifyProfileSettings.mjs` | Prior | Not Tested |
| `scripts/verifyHabitsIntegration.mjs` | Prior | Not Tested |
| `scripts/verifyCheckinsCalendar.mjs` | Prior | Not Tested |
| `scripts/verifyAnalyticsIntegration.mjs` | Prior | Not Tested |
| `scripts/verifyGoalsAchievements.mjs` | Prior | Not Tested |
| `scripts/verifyJournalIntegration.mjs` | Prior | Not Tested |
| `scripts/verifyNotificationsIntegration.mjs` | Prior | Not Tested |

2. **Production build:** `npm run build` — Not Tested in final phase yet.
3. **Manual UI:** Stages 3–11 against `npm run dev` + running API.
4. **Console / network:** DevTools during scenarios — Not Tested yet.
5. **No** Playwright/Cypress suite exists — gap (Medium).

---

## 8. Backend regression strategy

```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
.\.venv\Scripts\python.exe -m pytest tests/ -q --tb=line
```

| Suite | Files | Final phase status |
|-------|-------|--------------------|
| Auth | `test_auth.py` | **PASS (20/20)** Stage 3 |
| Users | `test_users.py` | Not Tested |
| Habits | `test_habits.py` | Not Tested |
| Check-ins | `test_checkins.py` | Not Tested |
| Calendar | `test_calendar.py` | Not Tested |
| Analytics | `test_analytics.py` | Not Tested |
| Goals | `test_goals.py` | Not Tested |
| Achievements | `test_achievements.py` | Not Tested |
| Journal | `test_journal.py` | Not Tested |
| Notifications | `test_notifications.py`, `test_notifications_migration.py` | Not Tested |
| **Full** | `tests/` | **Must remain ≥ 150 Pass** |

Tests use isolated SQLite fixtures (see `conftest.py`) — safe relative to `habit_hero.db`.

---

## 9. Production-readiness checklist (Stage 15)

| ID | Item | Status |
|----|------|--------|
| PR1 | Frontend production build | Not Tested |
| PR2 | Env-based API URL | Informational Pass *(`.env.example` present)* |
| PR3 | Backend env secrets for prod | Fail *(default SECRET_KEY pattern — must change for deploy)* |
| PR4 | CORS for production origin | Not Tested / config gap |
| PR5 | Production database (non-SQLite) plan | Not ready without work |
| PR6 | HTTPS / reverse proxy | Not ready |
| PR7 | Migration strategy documented | Partial (`backend/README.md`) |
| PR8 | Logging / monitoring | Not ready |
| PR9 | Backups | Not ready |
| PR10 | Root setup README | Missing |
| PR11 | Error boundaries | Missing |
| PR12 | Scheduler off in prod unless intentional | Confirm in Stage 13/15 |

**Provisional classification (inspection only — not a final readiness claim):**

> **Ready for local demonstration** pending Stages 3–14 Pass.  
> **Not ready for production** without secrets, hosting, HTTPS, stronger DB, CORS, monitoring, and documentation updates.

---

## 10. Known limitations

1. In-app notifications only (no email / SMS / push).
2. Notification scheduler disabled by default.
3. Legacy localStorage domain data not migrated.
4. Session tokens in sessionStorage (XSS surface; lost when tab closes).
5. SQLite single-file DB for local/dev.
6. No automated browser E2E.
7. Growth % display may still use static mock constants on some cards.
8. Stub `services/api.js` leftover.
9. No monorepo root README.

---

## 11. Risk classification (pre-execution)

| Risk | Severity | Mitigation in final phase |
|------|----------|---------------------------|
| Cross-module stale UI after mutations | High | Scenario X1–X4 |
| Account isolation leak | Critical | Scenario X5 + auth tests |
| Token/session edge cases | Critical | Stage 3 |
| Calendar scheduling correctness | High | Stage 6 |
| Analytics wrong source of truth | High | Stage 7 |
| Journal/day_notes confusion | Medium | Stage 9 + X3 |
| Notification duplicate generation | Medium | Stage 10 + X4 |
| Production secret/CORS/SQLite | High (deploy) | Stage 15 assess only |
| Missing ErrorBoundary | Medium | Document; fix only if approved |
| Untouched legacy localStorage | Medium | Do not auto-import |

---

## 12. Recommended execution order

| Order | Stage | Gate |
|-------|-------|------|
| Done | 1 Inspection | — |
| Done | 2 This plan | **STOP — await approval** |
| Next | 3 Authentication | Approval approval |
| | 4 Profile & settings | Approval |
| | 5 Habits | Approval |
| | 6 Check-ins & calendar | Approval |
| | 7 Dashboard & analytics | Approval |
| | 8 Goals & achievements | Approval |
| | 9 Journal | Approval |
| | 10 Notifications | Approval |
| | 11 Cross-module scenarios | Approval |
| | 12 API & database | Approval |
| | 13 Security review | Approval |
| | 14 Regression (build + pytest + smokes) | Approval |
| | 15 Production readiness | Approval |
| | 16 `FINAL_VALIDATION_REPORT.md` | Approval |

**Defect protocol:** Report issue → repro → files → proposed fix → impact → **wait for approval** before code changes.

---

## 13. Stage progress log

| Stage | Result | Date |
|-------|--------|------|
| 1 Inspection | Complete | 2026-11-11 |
| 2 Validation plan | Complete | 2026-11-11 |
| 3 Authentication | **Complete — all A1–A16 PASS** | 2026-11-11 |
| 4–16 | Not started — awaiting approval | — |

---

## 14. Blockers

| Blocker | Severity | Notes |
|---------|----------|-------|
| None for Stage 4 | — | Auth lifecycle validated |
| Live smoke scripts require API up | Medium | Confirmed healthy at Stage 3 start |
| Must not touch `habit_hero.db` destructively | Critical | Pytest used isolated fixtures; live tests only added ephemeral users |

**No application code was modified during Stages 1–3** (validation scripts under `frontend/scripts/` only; plan docs updated).
