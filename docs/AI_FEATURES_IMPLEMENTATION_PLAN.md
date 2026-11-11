# Habit Hero – AI Features Implementation Plan

**Status:** Stages A–E complete · Stage F PDF + Stage G Google Calendar implemented — see `docs/PHASE_F_PDF_EXPORT_IMPLEMENTATION_PLAN.md`, `docs/PHASE_G_GOOGLE_CALENDAR_IMPLEMENTATION_PLAN.md`, `docs/FINAL_PROJECT_VALIDATION_REPORT.md`  
**Date:** 2026-11-11  
**Constraint:** Gemini key stays backend-only · reuse existing habit/goal/journal/auth · no redesign · no migrations unless approved · one feature at a time  

---

## Stage E result – AI Insights Dashboard

| Item | Detail |
|------|--------|
| Route | `/ai-insights` under `ProtectedRoute` + `MainLayout` |
| Page | `frontend/src/pages/AIInsights/AIInsights.jsx` (+ CSS) |
| Nav | Sidebar item **AI Insights** (`Sparkles`) after Journal |
| Reused | `HabitSuggestions`, `JournalMoodAnalysis`, `aiApi`, mappers — no new backend AI endpoints |
| Overview | Static capability intro + in-page shortcuts; **no** fake stats; **no** auto Gemini on load |
| Polish | Long-wait (~90s) copy; “Analyze My Journal” CTA; regenerate clears added keys |
| Plan doc | `docs/PHASE_E_AI_INSIGHTS_IMPLEMENTATION_PLAN.md` |
| Smoke | `verifyAiInsightsPage.mjs` **7/7** · habit **7/7** · journal **10/10** |
| Backend regression | **181 passed** (unchanged baseline) |
| Frontend build | Succeeded |

---

## Stage D result – AI Journal Mood & Motivation Analysis

| Item | Detail |
|------|--------|
| Endpoint | `POST /api/v1/ai/mood-analysis` (JWT required) |
| Service | `app/services/ai_journal_service.py` — loads caller’s journal via `journal_service.list_entries`, min **3** entries, one Gemini JSON call |
| Schemas | `MoodAnalysisRequest`, `MoodAnalysisLLMResponse`, `MoodAnalysisData`, `MoodPatterns`, `AnalysisPeriod` in `app/schemas/ai.py` |
| Journal retrieval | Date-filtered, user-scoped; sends date/mood/tags/title/content snippet only (no email/ids) |
| Persistence | None — analysis is ephemeral |
| Frontend | `aiApi.moodAnalysis`, `toMoodAnalysisPayload` / `mapMoodAnalysisFromApi`, reusable `JournalMoodAnalysis` (routed via Stage E AI Insights) |
| Automated tests | `tests/test_ai_journal_analysis.py` → **11** cases (Gemini mocked) |
| AI pytest slice | journal + habit + gemini → **31 passed** |
| Full pytest | **181 passed** (Stage C baseline **170** + **11** Stage D) |
| Frontend build | `npm run build` succeeded |
| Smoke | `verifyAiJournalAnalysis.mjs` + `verifyAiHabitSuggestions.mjs` |
| Live Gemini | `gemini-3.8-flash` mood structured call hit upstream **504 DEADLINE_EXCEEDED** (~89s); API maps to clear timeout error with no retries. Habit suggestions previously succeeded on same model. |

**Response `data` fields:** `overall_mood`, `mood_summary`, `mood_patterns` `{ positive, challenging }`, `motivation_patterns`, `positive_observations`, `areas_to_improve`, `recommendations`, `summary`, `entries_analyzed`, `analysis_period`.

**Known limitations:** Not on AI Insights page yet; empty/&lt;3 entries return **400** without Gemini; prompt capped at 100 entries / truncated content; live generate can still 504; no clinical diagnosis; analysis not stored.

---

## Stage C result – AI Habit Suggestions

| Item | Detail |
|------|--------|
| Endpoint | `POST /api/v1/ai/habit-suggestions` (JWT required) |
| Service | `app/services/ai_habit_service.py` — loads active habits + active goals via existing services, one Gemini JSON call, validates/dedupes, returns ≤5 suggestions |
| Schemas | `app/schemas/ai.py` — `HabitSuggestionItem`, `HabitSuggestionsRequest/Data/ApiResponse`, LLM response schema |
| Categories | Exact habit API values: `Health`, `Work`, `Learning`, `Productivity`, `Mental Health` |
| Frequencies | `Daily` / `Weekly` (lowercase AI output normalized) |
| Persistence | None — suggestions are ephemeral |
| Frontend | Reusable `HabitSuggestions` component + `aiApi` / `aiMappers` (not routed yet; Stage G) |
| Add Habit | Maps suggestion → `HabitContext.addHabit` payload; guards duplicate clicks |
| Automated tests | `tests/test_ai_habit_suggestions.py` (Gemini mocked) → **10** cases |
| AI pytest slice | `test_ai_habit_suggestions` + `test_gemini_config` → **20 passed** |
| Full pytest | **170 passed** (Stage B baseline **160** + **10** Stage C) |
| Frontend build | `npm run build` succeeded |
| Smoke | `frontend/scripts/verifyAiHabitSuggestions.mjs` **7 passed**; habits smoke **15 passed** |
| Live Gemini | With `GEMINI_MODEL=gemini-3.8-flash`, structured habit suggestions **succeeded** (~61s, 5 valid items). Local `.env` still on `gemini-2.5-flash` → **404** until updated. Upstream 504s remain possible; API maps them to clear 5xx with **no automatic retries**. |

**Example validated response (`data`):** five items with `name`, `description`, `category`, `frequency`, `reason`, `recommended_start_date`.

**Known limitations:** Component not on AI Insights page yet; live Google generate can 404 (wrong local model) or 504; no automatic Gemini retries; suggestions not stored.

---

## Stage B result – Gemini configuration

| Item | Detail |
|------|--------|
| SDK | `google-genai==3.1.0` added to `requirements.txt` and installed in venv |
| Config | `GEMINI_API_KEY`, `GEMINI_MODEL` (default **`gemini-3.8-flash`**), `GEMINI_TIMEOUT_SECONDS` (default 90) via `app/core/config.py` |
| Service | `app/services/gemini_service.py` — client init, `generate_text`, `generate_json`, `verify_connection`, typed errors |
| Probe script | `scripts/verify_gemini_connection.py` (local only; skips if key missing; never prints key) |
| `.env.example` | Placeholders added · **`.env` not overwritten** · `.env` remains gitignored |
| Automated tests | `tests/test_gemini_config.py` → **10 passed** (fully mocked) |
| Full pytest | **160 passed** (150 prior + 10 Gemini) |
| Live probe | Key present and accepted by Google. Obsolete models (`gemini-2.5-flash`, `gemini-2.0-flash`) → **404** with guidance to use **`gemini-3.8-flash`**. Live `generate_content` to `gemini-3.8-flash` returned Google **504 DEADLINE_EXCEEDED** (upstream timeout). Not a missing-key issue. |

**Default model decision:** Use `gemini-3.8-flash` (Google’s current recommendation for this API key). If `.env` still sets `GEMINI_MODEL=gemini-2.5-flash`, update it locally (do not commit secrets).

**Limitations (Stage B):** Live generate may time out depending on Google API availability; CI must keep using mocks.

---

## 1. Architecture alignment

```
React AI Insights page
      │  JWT via existing apiClient
      ▼
POST /api/v1/ai/habit-suggestions
POST /api/v1/ai/mood-analysis
      │  CurrentUser + DbSession
      ▼
AI services (habit / journal)
      │  load owned habits / goals / journal
      ▼
Gemini client wrapper (google-genai)
      │  GEMINI_API_KEY from backend/.env only
      ▼
Structured JSON → Pydantic validate
      ▼
API envelope { success, message, data }
      ▼
React UI (Add Habit → existing habitApi / HabitContext.addHabit)
```

### Reuse (do not duplicate)

| Concern | Existing asset |
|---------|----------------|
| Auth | JWT `CurrentUser`, `apiClient` refresh |
| Habits | `habit_service.list_habits`, `POST /habits`, `HABIT_CATEGORIES`, frequencies `Daily`/`Weekly` |
| Goals | `goal_service.list_goals` (active / non-archived) |
| Journal | `journal_service.list_entries` with `start_date` / `end_date`, user-scoped |
| Frontend habits | `HabitContext.addHabit` + `toHabitCreatePayload` |
| Nav / layout | `Sidebar.jsx` navItems + `App.jsx` protected routes |
| API style | `services/api/*Api.js` + mappers + `{ success, message, data }` |

### Habit contract (critical for AI output)

| Field | Allowed values |
|-------|----------------|
| `category` | `Health`, `Work`, `Learning`, `Productivity`, `Mental Health` |
| `frequency` | `Daily`, `Weekly` (backend casing — **not** `daily`/`weekly`) |
| `start_date` | `YYYY-MM-DD` |
| Weekly | `week_day` 0–6 optional; backend can derive from start_date |

**Plan:** AI schemas / post-processing normalize frequency to `Daily`/`Weekly` and reject or remap invalid categories before returning to clients.

### Journal moods (context for analysis prompts)

`happy`, `productive`, `motivated`, `neutral`, `tired`, `stressed`, `sad`  
Analysis must not invent clinical diagnoses.

---

## 2. Backend layout (Stage C implemented)

```
backend/app/
  core/config.py                 # GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT_SECONDS
  services/
    gemini_service.py            # Stage B shared client + generate_json
    ai_habit_service.py          # Stage C habit suggestions
    ai_journal_service.py        # Stage D mood analysis
  schemas/ai.py                  # habit + mood analysis schemas
  api/v1/endpoints/ai.py         # POST /ai/habit-suggestions, /ai/mood-analysis
  api/v1/router.py               # includes ai router
tests/
  test_gemini_config.py
  test_ai_habit_suggestions.py
  test_ai_journal_analysis.py
```

**Env (`.env` / `.env.example` only — never commit real keys):**

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_SECONDS=90
```

Model ID finalised in Stage B: **`gemini-3.8-flash`** (2.5/2.0 flash unavailable to this key).

**Dependency:** `google-genai==3.1.0` in `requirements.txt` (Stage B done).

**No DB tables / Alembic** for AI responses (ephemeral analysis unless later approved).

---

## 3. API contracts

### `POST /api/v1/ai/habit-suggestions` — **implemented (Stage C)**

- Auth: required  
- Body: empty `{}` or optional `{ "count": 5 }` (default 5, max 5)  
- Server loads: active habits + active goals for `current_user` (existing services only)  
- Single Gemini `generate_json` call with structured schema; no automatic retries  
- Dedupes vs existing habit names (case-insensitive; near-duplicate substring guard)  
- Response `data`: `{ "suggestions": [...], "count": N }` where each suggestion has `name`, `description`, `category`, `frequency`, `reason`, `recommended_start_date`  
- Errors: 503 missing key · 429 rate limit · 504 timeout · 502 invalid/upstream · 401/403 unauth  

### Frontend integration (Stage C — reusable, not routed)

| Asset | Role |
|-------|------|
| `frontend/src/services/api/aiApi.js` | `habitSuggestions(payload)` via `apiClient` |
| `frontend/src/services/api/aiMappers.js` | API ↔ UI map; `suggestionToHabitPayload` for create |
| `frontend/src/components/ai/HabitSuggestions.jsx` | Generate / loading / errors / Retry / Add Habit |
| `frontend/scripts/verifyAiHabitSuggestions.mjs` | Smoke: auth, graceful AI errors, mapper, add-habit payload |

Add Habit uses `HabitContext.addHabit` only. No Gemini key in the browser. AI Insights page / nav deferred to Stage G.

### `POST /api/v1/ai/mood-analysis` — **implemented (Stage D)**

- Auth: required  
- Body: `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }` (end ≥ start)  
- Loads only caller’s journal entries in range via `journal_service.list_entries`  
- If **0** entries: **400** “No journal entries…” — no Gemini call  
- If **&lt; 3** entries: **400** insufficient entries — no Gemini call  
- Single Gemini `generate_json` call; wellness tone; no diagnosis; no fabricated stats  
- Response `data`: `overall_mood`, `mood_summary`, `mood_patterns` `{positive, challenging}`, `motivation_patterns`, `positive_observations`, `areas_to_improve`, `recommendations`, `summary`, `entries_analyzed`, `analysis_period`  
- Not persisted  

### Frontend integration (Stage D — reusable, not routed)

| Asset | Role |
|-------|------|
| `aiApi.moodAnalysis(payload)` | Shared `apiClient` POST |
| `toMoodAnalysisPayload` / `mapMoodAnalysisFromApi` | Date validation + camelCase UI map |
| `components/ai/JournalMoodAnalysis.jsx` | Date range / loading / errors / Retry / results |
| `scripts/verifyAiJournalAnalysis.mjs` | Mapper + auth + empty + live/graceful failure |

### Errors (safe messages)

| Case | Status | Message style |
|------|--------|---------------|
| Missing/blank `GEMINI_API_KEY` | 503 | AI not configured |
| Gemini rate limit / upstream | 502/429 | Temporary AI failure |
| Invalid AI JSON | 502 | Invalid to parse AI response |
| Invalid date range | 422 | Validation |
| Empty/insufficient journal | 400/422 | Need more entries |
| Unauthenticated | 401/403 | Existing auth behaviour |

Never return stack traces or API keys.

---

## 4. Gemini integration approach

1. `genai.Client(api_key=settings.gemini_api_key)` — key from settings only.  
2. `models.generate_content` with `response_mime_type="application/json"` + Pydantic `response_schema`.  
3. Validate again with app Pydantic models before HTTP response.  
4. Server-side filters: categories ∈ `HABIT_CATEGORIES`; frequency ∈ `Daily`/`Weekly`; dates ISO; drop near-duplicate names.  
5. Tests **mock** the client — no real quota in pytest.  
6. Stage B: one optional live connection probe script (manual / opt-in), not in default CI.

---

## 5. Frontend plan

| Item | Action |
|------|--------|
| `services/api/aiApi.js` | **Done (C/D):** `habitSuggestions()` + `moodAnalysis()` |
| `services/api/index.js` | **Done (C/D):** export `aiApi` + mappers |
| `pages/AIInsights/AIInsights.jsx` + CSS | **Done (E)** |
| `components/ai/HabitSuggestions.jsx` | **Done (C/E polish)** |
| `components/ai/JournalMoodAnalysis.jsx` | **Done (D/E polish)** |
| `components/ai/AIInsightCard.jsx` | Skipped — page-local overview markup |
| `App.jsx` | **Done (E)** — route `/ai-insights` |
| `Sidebar.jsx` | **Done (E)** — Sparkles nav item |

**Add Habit:** map suggestion → `addHabit({ name, description, category, frequency, startDate: recommended_start_date })` — existing create path only.

No second Axios instance. No Gemini calls from React.

---

## 6. Testing plan

| Stage | Tests |
|-------|-------|
| B | Config missing key; client factory; model setting present |
| C–D | Habit suggestions schema; mock Gemini; dedupe; auth; ownership context; add via habit API |
| E–F | Date validation; empty journal; isolation; mock Gemini; invalid output handling |
| H | Full pytest ≥ 150 + new AI tests; `npm run build` |

---

## 7. Documentation plan (Stage I)

Update `backend/README.md` (and root README if approved): AI features, env vars, install `google-genai`, endpoints, limitations (no clinical diagnosis, no key in frontend, ephemeral analysis, quota/rate limits).

---

## 8. Execution gates (unchanged)

| Stage | Scope | Gate |
|-------|-------|------|
| **A** | Inspection + this plan | **Done** |
| **B** | Gemini config + connection test | **Done** |
| **C** | AI Habit Suggestions (API + reusable UI) | **Done** |
| **D** | AI Journal Mood Analysis (API + reusable UI) | **Done** |
| **E** | Frontend AI Insights page + nav | **Done — await approval before F** |
| F | PDF Export (not started) | Approval |
| G | — | — |
| H | Regression + build | Approval |
| I | Documentation | Approval |

---

## 9. Risks & decisions to confirm

| Topic | Proposal | Needs approval? |
|-------|----------|-----------------|
| Frequency casing | Accept AI `daily`/`weekly` but **normalize to `Daily`/`Weekly`** | Confirm |
| Insufficient journal threshold | **3** entries minimum | Confirm or change |
| Default model | **`gemini-3.8-flash`** (verified available; 2.5/2.0 flash 404 for this key) | Done in Stage B |
| Persist AI results | **No** | Confirmed by requirements |
| Migrations | **None** | Confirmed |
| Final validation Phase | Independent; AI work proceeds under this plan | Note |

---

## 10. Out of scope

- Redesign of existing pages  
- Enabling notification scheduler  
- Email/SMS/push  
- Mental-health diagnosis  
- Frontend possession of `GEMINI_API_KEY`  
- Automatic import of legacy localStorage data  

**No application code was modified for Stage A** (this plan document only).
