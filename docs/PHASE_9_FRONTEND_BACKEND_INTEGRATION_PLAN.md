# Habit Hero – Phase 9 Frontend ↔ Backend Integration Plan

**Status:** Steps A–J complete · Phase 9 integration steps done (awaiting final approval)  
**Backend baseline:** Stages 1–10 complete · **150** pytest cases passing (confirmed)  
**Backend base URL:** `http://127.0.0.1:8000` · API prefix `/api/v1` · Swagger `/docs`  
**Constraint:** Preserve existing React UI/UX · no unnecessary packages · backend is source of truth · do not rewrite backend modules

---

## 1. Inspection summary

### 1.1 Frontend architecture (current)

| Area | Location | Data source today |
|------|----------|-------------------|
| Entry / routing | `src/main.jsx`, `src/App.jsx` | React Router; `ProtectedRoute` gates app shell |
| Auth | `AuthContext` + `services/authService.js` | **localStorage** users (`habit-hero-users`) + session (`habit-hero-auth`); client SHA-256 passwords; fake UUID “token” |
| Avatar | `services/profileImageService.js` | **IndexedDB** blob store (`habit-hero-profile`) |
| Domain state | `HabitContext.jsx` | **localStorage** blob `habit-hero-data-v3` (habits+checkins nested, goals, journal, dayNotes, achievements, goalTarget) |
| Defaults / mocks | `data/mockData.js` | Seed habits/goals; `notifications[]`; fake growth % (`completionGrowth`, `weeklyConsistencyGrowth`) |
| Stub API | `services/api.js` | Axios to `VITE_API_URL \|\| http://localhost:8000/api` — **wrong prefix**, **unused** by contexts/pages |
| Calculations | `utils/*Calculations.js` | Client-side schedule, streaks, analytics, goals, journal, achievements |
| Notifications UI | `PageHeaderTools.jsx` | Mock notifications + local mark-all-read |
| Settings | `pages/Settings/Settings.jsx` | Clears local habit storage only; no reminder prefs UI |
| Env | none | No `.env` / `.env.example` for API URL |

**Pages (preserve layout):** Dashboard, Habits, Calendar, Analytics, Goals (+ Achievements), Journal, Settings, Profile, Login, Signup.

### 1.2 Backend API surface (complete — reuse as-is)

| Module | Prefix | Notes |
|--------|--------|--------|
| Auth | `/api/v1/auth` | register, login, refresh, logout, me |
| Users | `/api/v1/users/me*` | profile, avatar multipart, password, settings (+ notification prefs) |
| Habits | `/api/v1/habits` | CRUD, archive/restore, filters |
| Check-ins | `/api/v1/habits/{id}/checkins` | CRUD by habit |
| Calendar | `/api/v1/calendar` | monthly, daily, summary, day notes |
| Analytics | `/api/v1/analytics` | overview, habit, weekly, monthly, categories, best-days, streaks |
| Goals | `/api/v1/goals` | CRUD + summary + computed progress/status |
| Achievements | `/api/v1/achievements` | list, summary, get |
| Journal | `/api/v1/journal` | CRUD, filters, summary |
| Notifications | `/api/v1/notifications` | list/summary/read/read-all/generate/delete |
| Health | `/api/v1/health` | liveness |

Envelope: `{ success, message, data }`. Errors: `{ success: false, message, detail }`.

### 1.3 Critical contract mismatches (document before coding)

| Topic | Frontend today | Backend contract | Integration approach |
|-------|----------------|------------------|----------------------|
| Field naming | camelCase (`fullName`, `startDate`, `linkedHabitId`) | snake_case (`full_name`, `start_date`, `linked_habit_id`) | Central mappers in API layer / adapters; keep UI camelCase |
| Auth | SHA-256 local users; single fake token | bcrypt + JWT access + rotating refresh | Replace `authService`; store access+refresh securely; no password storage |
| User shape | `{ id, fullName, email, createdAt }` | `{ id, full_name, email }` (+ profile `avatar_url`, `created_at`) | Map on read/write |
| Habits + check-ins | Nested `habit.checkins[date]` | Separate habit + check-in resources | Load habits; hydrate check-ins (batch/list or calendar daily) into UI shape **or** thin adapter |
| Habit update verb | Stub used PUT | **PATCH** | Use PATCH |
| Avatar size | Max **5 MB** client validation | Max **2 MB** (`MAX_AVATAR_BYTES`) | Align client validation to **2 MB** (document; do not raise backend limit unless approved) |
| Avatar storage | IndexedDB | Server file + `avatar_url` | Use backend upload/delete; display `avatar_url` (absolute or prefix with API origin) |
| Analytics / dashboard stats | Client calc + mock growth % | Analytics APIs | Prefer backend overview/weekly/streaks; drop mock growth or omit if API has no growth field |
| Goals progress / status | Client `goalCalculations` | Backend computed on goal responses | Prefer API `progress` / `status`; stop dual completion sync |
| Achievements | Client `evaluateAchievements` | Server awards + list/summary | Fetch after check-in/goal; do not re-award in React |
| Notifications | Mock array | Notifications APIs | Wire inbox; `refresh` on open |
| Streak goal target | `goalTarget` in habit localStorage | `user_settings.streak_goal_target` | Load/save via settings API |
| Reminder prefs | Not in Settings UI | Settings booleans | Add minimal prefs controls **only if needed for Stage J**; otherwise load silently for generation |
| API base | Stub `/api` | `/api/v1` | `VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1` |
| selectedDate | localStorage | Not persisted server-side | **Keep client-only** (allowed UI preference) |
| sidebarOpen | React state | N/A | Client-only |

**Rule:** Do not change backend business logic to match incorrect frontend assumptions. Prefer frontend adapters. If a hard conflict appears during implementation, stop and document before backend changes.

---

## 2. Target integration architecture

```
src/
  services/
    api/
      apiClient.js          # axios instance, auth headers, refresh queue, errors
      authApi.js
      userApi.js
      habitApi.js
      checkinApi.js         # optional separate file
      calendarApi.js
      analyticsApi.js
      goalApi.js
      achievementApi.js
      journalApi.js
      notificationApi.js
    mappers/                # snake_case ↔ camelCase (optional colocated)
  context/
    AuthContext.jsx         # JWT session restore, logout clears domain state
    HabitContext.jsx        # API-backed loaders/mutations; no domain localStorage blob
```

- Reuse existing **axios** dependency (already in `package.json`).
- Replace / deprecate unused stub `services/api.js`.
- Keep component tree and CSS; change data plumbing in services + contexts primarily.

### Token storage decision (after inspection)

| Option | Pros | Cons |
|--------|------|------|
| localStorage access + refresh | Matches current session pattern; survives reload | XSS risk (same as today’s prototype) |
| memory-only access + httpOnly cookie refresh | Safer | Backend does not set cookies today |

**Plan:** Persist `{ access_token, refresh_token, user }` in localStorage under a new key (e.g. `habit-hero-auth-v2`). Never store passwords. Clear on logout / refresh failure. Single-flight refresh interceptor. Migrate away from `habit-hero-users` and SHA-256 hashes.

---

## 3. Execution order (mandatory)

| Step | Scope | Gate before next |
|------|-------|------------------|
| A | This plan | **Done** |
| B | API infrastructure + env | **Done** |
| C | Authentication | **Done** (JWT; prototype auth removed) |
| D | Profile + settings | **Done** (avatar server-backed; reminder prefs) |
| D | Profile + settings | Avatar/password/settings |
| E | Habits | CRUD/archive/filters |
| F | Check-ins + calendar + day notes | Toggle/calendar sync |
| G | Dashboard + analytics | Backend stats |
| H | Goals + achievements | No client award logic |
| I | Journal | Filters/summary; ≠ day notes |
| J | Notifications | Inbox unread/read-all |
| Final | Workflows + regression | Report |

After each step: frontend build, affected pages, console/network, loading/errors, fix before proceeding. Backend regression **149** must remain green if any backend file is touched (prefer zero backend changes).

---

## 4. Feature integration matrix

### 4.1 Authentication

| Item | Detail |
|------|--------|
| Existing source | `authService` localStorage |
| APIs | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Request | register: `{ full_name, email, password }` · login: `{ email, password }` · refresh/logout: `{ refresh_token }` |
| Response | TokenPair: `access_token`, `refresh_token`, `token_type`, `user` |
| State | `AuthContext`: user, accessToken, loading; map `full_name` → `fullName` for UI |
| Errors | 401 invalid credentials; 409 email exists; 422 validation → form messages |
| Dependencies | Step B apiClient refresh queue |
| Notes | Signup form field names → snake_case body; password strength matches backend |

### 4.2 User profile & settings

| Item | Detail |
|------|--------|
| Existing source | Auth local users + IndexedDB avatar; Settings clears `STORAGE_KEY` |
| APIs | `GET/PATCH /users/me`, `POST/DELETE /users/me/avatar`, `PATCH /users/me/password`, `GET/PATCH /users/me/settings` |
| Request | Profile: `{ full_name?, email? }` · Password: `{ current_password, new_password }` · Avatar: `multipart/form-data` field `file` · Settings: streak + reminder flags |
| Response | Profile includes `avatar_url`; settings include prefs |
| State | AuthContext avatar from URL; settings cache optional |
| Errors | 413/400 oversized/invalid image; 401 wrong password; 409 email |
| Contract note | Lower client max image to **2 MB** to match backend |
| Dependencies | Auth |

### 4.3 Habits

| Item | Detail |
|------|--------|
| Existing source | HabitContext + localStorage + mock defaults |
| APIs | `POST/GET/PATCH/DELETE /habits`, `PATCH .../archive`, `PATCH .../restore` |
| Request | Create/update snake_case schedule fields; Weekly `week_day` 0=Sun…6=Sat |
| Response | Habit objects (`is_archived` / archived flag per schema) |
| State | Replace seed habits with API list on login; CRUD updates context |
| Errors | 404 ownership; 422 validation; archive-vs-delete rules |
| Dependencies | Auth; check-ins hydrate (Step F) for nested UI |

### 4.4 Check-ins & calendar

| Item | Detail |
|------|--------|
| Existing source | Nested checkins + `dayNotes` map + client schedule utils |
| APIs | Check-ins under habit; `GET /calendar/monthly|daily|summary`; day notes CRUD |
| Request | Check-in `{ date, status, notes? }` · Note `{ date, notes }` |
| Response | Calendar day statuses: completed/pending/missed/not_scheduled; `has_journal` / `has_notes` |
| State | `toggleHabit` / notes → API; refresh calendar/day view after mutations |
| Errors | 400 unscheduled/archived; 409 duplicate check-in |
| Strategy | Prefer calendar APIs for day/month views; keep light client helpers only for presentation if needed |
| Dependencies | Habits |

### 4.5 Dashboard & analytics

| Item | Detail |
|------|--------|
| Existing source | HabitContext derived stats + mock growth; Analytics page client calculators |
| APIs | `/analytics/overview`, `/habits/{id}`, `/weekly`, `/monthly`, `/categories`, `/best-days`, `/streaks` |
| State | Fetch on mount / date-range change; empty datasets → zeros |
| Remove | `completionGrowth` / `weeklyConsistencyGrowth` as fake growth (or hide growth UI if no API field) |
| Dependencies | Auth; habits/check-ins populated |

### 4.6 Goals & achievements

| Item | Detail |
|------|--------|
| Existing source | local goals + client progress/status + client achievement unlock |
| APIs | Goals CRUD/summary; Achievements list/summary/get |
| State | Load goals from API; use server `progress`/`status`; refresh achievements after check-in/goal mutations |
| Stop | `evaluateAchievements` / `syncAllGoalsCompletion` as writers of truth |
| Dependencies | Habits; check-ins (server-side progress) |

### 4.7 Journal

| Item | Detail |
|------|--------|
| Existing source | local `journalEntries` + client filters/summary |
| APIs | Journal CRUD, list filters, summary |
| State | API-backed; keep mood/tag enums aligned |
| Preserve | Separation from calendar `day_notes` |
| Dependencies | Auth; optional habit_id ownership |

### 4.8 Notifications

| Item | Detail |
|------|--------|
| Existing source | `mockData.notifications` in `PageHeaderTools` |
| APIs | list (`refresh`), summary, mark read, read-all, delete, generate |
| State | Unread count + inbox list; mark-all-read hits API |
| Dependencies | Auth; settings prefs (generation) |

---

## 5. localStorage / mock retirement plan

| Key / artifact | After Phase 9 |
|----------------|---------------|
| `habit-hero-users` | **Remove** (no local password DB) |
| `habit-hero-auth` | Replace with JWT session key |
| `habit-hero-data-v3` | **Stop** persisting habits/goals/journal/checkins/achievements/dayNotes |
| IndexedDB avatars | **Stop** as source of truth; optional cache only |
| `mockData` defaults | Dev seed optional behind flag — **not** production path |
| `mockData.notifications` | Unused |
| `selectedDate` | May remain ephemeral or local UI preference only |
| Stub `api.js` | Replaced by `services/api/*` |

---

## 6. State synchronization strategy

1. On authenticated boot: validate access (or refresh) → `GET /auth/me` → parallel load habits, settings, goals, journal summary/list as needed.
2. Mutations: optimistic UI only where safe; otherwise await API then patch context or refetch module slice.
3. Cross-module refresh: after check-in → refresh day calendar slice + analytics overview (debounced) + achievements summary.
4. Logout: clear auth tokens, clear HabitContext domain state, revoke avatar object URLs.
5. Avoid duplicate in-flight loads with simple request guards / AbortController where lists remount.

---

## 7. Error / loading / empty UX (preserve design)

- Reuse existing `Loader`, form error banners, empty copy in lists.
- Map API `message` / validation `detail` to user-visible strings.
- Network failures: non-blocking toast or inline error without redesign.
- Empty habits/goals/journal/analytics: keep current empty-state components; ensure they still render with `[]` / zero payloads.

---

## 8. Testing plan (Phase 9)

### Per-step
- `npm run build` in `frontend/`
- Manual page check + Network tab (correct `/api/v1`, Authorization header)
- Console clean of uncaught errors

### Backend
- If any backend change: `pytest tests/` must stay **≥ 149**
- Prefer **no** backend edits

### Final workflows (from brief)
1. Register → Login → Dashboard → Logout  
2. Create Habit → Check In → Calendar → Analytics  
3. Create Goal → Progress → Complete → Achievement  
4. Journal CRUD + search  
5. Notifications generate → inbox → read → delete  
6. Profile/settings → reload → persistence  
Plus: invalid credentials, expired refresh, empty data, multi-user isolation, responsive layouts

---

## 9. Files expected (create / modify) — preview only

**Create (Step B+):**  
`frontend/.env.example`, `frontend/.env` (local), `src/services/api/*.js`, mappers as needed.

**Modify (sequential):**  
`AuthContext`, `authService` (or replace), `profileImageService` usage, `HabitContext`, `PageHeaderTools`, pages that assume local-only data, `ProtectedRoute` if needed, remove/retire stub `api.js`.

**Do not modify for redesign:** page CSS, layout structure, Lucide icons, route paths.

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Nested check-in UI vs REST check-ins | Adapter layer; calendar daily for day view |
| Dual calculation drift | Prefer backend for analytics/goals/achievements |
| Avatar 5 MB vs 2 MB | Align FE validation; document |
| Refresh storms | Mutex / single promise for refresh |
| HabitContext becomes huge | Keep UI API stable; swap internals per stage |
| Accidental backend rewrites | Reject unless contract gap approved |

---

## 11. Explicit non-goals (this phase)

- UI redesign / new design system  
- New npm packages unless unavoidable (axios already present)  
- Celery/email/push  
- Changing Stage 6–10 backend business rules  
- Keeping mock data as production source of truth  

---

## 12. Step A checklist

| Item | Status |
|------|--------|
| Frontend structure / routing inspected | Done |
| Auth + Habit contexts + localStorage inspected | Done |
| Mock/stub API usage identified | Done |
| Backend endpoints / schemas inspected | Done |
| Contract mismatches documented | Done |
| Integration order defined | Done |
| Backend 149 baseline confirmed | Done |
| Frontend code modified | **No** |

---

### Step B result

- Created `frontend/src/services/api/*` (apiClient, tokenStore, apiError, domain modules).
- Env: `VITE_API_BASE_URL` via `.env` / `.env.example`.
- Smoke: `verifyApiClient.mjs` → 8 passed; build OK; backend **149**.

### Step C result

- Replaced SHA-256 / fake-token `authService` with FastAPI JWT (`authApi` + `tokenStore`).
- `AuthContext` boots via hydrate → `GET /auth/me`; logout revokes refresh; `setOnTokensCleared` clears UI on failed refresh.
- Register → auto-login (backend register returns user only).
- Tokens: **in-memory** + **sessionStorage** tab hydrate (not localStorage). Passwords never stored.
- Signup client validation aligned to backend password rules (8+ complexity).
- HabitContext / `habit-hero-data-v3` untouched. Prototype `habit-hero-users` accounts **not** migrated (must re-register).
- Avatar still IndexedDB until Step D.
- Smoke: `verifyAuthIntegration.mjs` → 10 passed; `npm run build` OK; backend **149**.

### Step D result

- Profile: GET/PATCH `/users/me`, password change with re-login after refresh revocation.
- Avatar: multipart upload/delete; UI limit **2 MB**; server `avatar_url` resolved via API origin; IndexedDB cleared only after successful server write.
- Settings page: streak_goal_target + Stage 10 reminder prefs; PATCH sends dirty fields only.
- AuthContext holds `settings` + server `avatarUrl`; nav/profile stay in sync.
- HabitContext / domain localStorage untouched.
- Smoke: `verifyProfileSettings.mjs` → 11 passed; build OK; backend **149**.

### Step E result

- Habits are API-backed via existing `habitApi` + new `habitMappers.js` (camelCase ↔ snake_case).
- `HabitContext`: fetch `GET /habits?status=all` after auth; create/update/archive/restore/delete; clear in-memory habits on logout / account switch; loading + error + Retry on Habits page.
- Field map: `startDate`↔`start_date`, `weekDay`↔`week_day` (Sun=0…Sat=6), `archived`↔`is_archived`. No `end_date`. Archive/delete follows backend soft-archive-when-history rules.
- **localStorage:** stopped using `habit-hero-data-v3.habits` as source of truth; persist path **preserves** legacy `habits` (nested check-ins) and does not auto-import into backend. No silent wipe. Explicit Settings “clear local data” still removes the whole blob (user-initiated).
- Check-ins: still in-memory only (`toggleHabit` / notes) — **Step F**.
- Smoke: `verifyHabitsIntegration.mjs` → **15** passed; `npm run build` OK; backend **149**.

**Legacy migration limitation:** Prototype habits in localStorage are not imported. Users must recreate habits on the server. Nested check-in history in the blob is retained until an explicit future migration (not Step E/F silent import).

### Step F result

- Check-ins: `toggleHabit` / `setHabitNotes` → `habitApi` create/update (status `completed`/`incomplete`); nested `habit.checkins[date]` holds `{ id, completed, notes }` via `checkinMappers.js`. Hydrate all check-ins after habit load. 409 duplicate → fetch-by-date + patch.
- Calendar page: `GET /calendar/monthly` + `/daily` (and summary available); cell status from API day summaries (`calendarMappers.js`); daily list/KPIs from daily API; `calendarTick` refreshes after check-in / day-note / habit mutations.
- Day notes: `calendarApi` CRUD; one note per date; empty save deletes; 409 → update existing. Separate from journal. Legacy `dayNotes` in localStorage preserved, not written as source of truth.
- Logout / account switch clears habits, check-ins, and day-note maps.
- Smoke: `verifyCheckinsCalendar.mjs` → **19** passed; `npm run build` OK; backend **149**.
- Future dates: UI blocks toggles via `isFuture`; backend may still accept scheduled future check-ins (calendar status rules apply for missed).

### Step G result

- Dashboard + Analytics consume FastAPI analytics (and calendar summary/monthly for trends/heatmap).
- Hooks: `useDashboardAnalytics`, `useProgressTrend`, `useMonthlyAnalytics`, `useAnalyticsPage`.
- Mappers: `analyticsMappers.js` (presentation only).
- Stat cards, weekly bars, categories pie, streaks, monthly overview stats, progress trend → API.
- Analytics tabs: overview / habits / categories / trends / insights wired; habit detail via `GET /analytics/habits/{id}`.
- Refresh via existing `calendarTick` after check-ins / habit mutations; generation guards prevent stale overwrites; cleared on logout.
- Client calc utils kept for date-range presets / display helpers; dashboard/analytics no longer use them as source of truth for rates/streaks.
- Smoke: `verifyAnalyticsIntegration.mjs` → **10** passed; `npm run build` OK; backend **149**.

### Step H result

- Goals CRUD + summary via `goalApi` + `goalMappers.js`; HabitContext loads goals after auth; status/progress from backend only.
- Achievements via `achievementApi.summary` (catalogue of 8); no client `evaluateAchievements` / `syncAllGoalsCompletion` writers.
- Refresh goals/achievements on `calendarTick` (check-ins / habit mutations) and after goal CRUD.
- Dashboard `NextGoal` shows highest-progress active backend goal (or empty state).
- localStorage: stop writing goals/unlockedAchievements as source of truth; preserve legacy blob keys; no silent import.
- Smoke: `verifyGoalsAchievements.mjs` → **16** passed; `npm run build` OK; backend **149**.

**Legacy limitation:** Prototype goals/achievements in `habit-hero-data-v3` are not imported. Users recreate goals on the server; achievements are awarded by the backend.

### Step I result

- Journal CRUD + list filters + summary via `journalApi` + `journalMappers.js`; HabitContext loads journal after auth; cleared on logout / account switch; generation guards on list/summary.
- Stats / overview / recent dates from `GET /journal/summary` (backend source of truth). History modal uses paginated `GET /journal` with search/date/mood/tag/habit/`general`/sort — no client-side full-list filtering for history.
- Mood/tag enums unchanged (`JOURNAL_MOODS` / `JOURNAL_TAGS`). Tag updates are replace-set; form clears habit via `clear_habit`.
- Mutations bump `calendarTick` so calendar `has_journal` refreshes. Journal records stay separate from calendar `day_notes`.
- **Backend fix (contract):** overlapping tag replace-set caused SQLite unique-constraint 500; `_replace_tags` now flushes deletes before inserts. Regression test added → **150** total.
- **localStorage:** stop writing `journalEntries` as source of truth; preserve legacy blob key; no silent import/wipe.
- Smoke: `verifyJournalIntegration.mjs` → **29** passed; `npm run build` OK; backend **150**.

**Legacy limitation:** Prototype journal entries in `habit-hero-data-v3` are not imported. Users create new journal entries on the server. Historical import (if needed) requires a separate approved migration step.

### Step J result

- Notifications inbox in `PageHeaderTools` wired to FastAPI via `notificationApi` + `notificationMappers.js`.
- HabitContext holds notification list/summary/unread; cleared on logout / account switch; generation guards prevent stale overwrites.
- Boot: `GET /notifications/summary?refresh=false` for badge only (no uncontrolled generation).
- Inbox open: `GET /notifications` with `refresh=true` at most once per 60s cooldown (backend generate+dedupe); load-more uses `refresh=false`.
- Mark read: `PATCH /notifications/{id}/read` on item click; mark-all: `POST /notifications/read-all`; delete: `DELETE /notifications/{id}` via dismiss control.
- Summary unread drives the header dot; list payload unread/total kept in sync after mutations.
- Settings reminder prefs (Step D) unchanged; no scheduler enablement; no email/SMS/push.
- `mockData.notifications` no longer used as source of truth.
- Smoke: `verifyNotificationsIntegration.mjs` → **21** passed; `npm run build` OK; backend **150**.

**Limitations:** In-app inbox only (no push/email/SMS). Optional `NOTIFICATIONS_SCHEDULER_ENABLED` remains false. Prototype mock notifications were never persisted in localStorage as a domain blob.

**Next action:** Wait for explicit approval before any final end-to-end / production-readiness phase.
