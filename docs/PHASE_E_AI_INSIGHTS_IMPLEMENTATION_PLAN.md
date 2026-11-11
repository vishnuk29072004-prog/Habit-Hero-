# Habit Hero – Stage E: AI Insights Dashboard

**Status:** **Implemented** · awaiting review before Stage F (PDF Export)  
**Date:** 2026-11-11  
**Scope:** Frontend composition page + routing/nav only · reuse existing AI APIs/components · no new Gemini endpoints · no PDF/Calendar  

---

## 1. Existing architecture findings

### Routing & auth
| Asset | Finding |
|-------|---------|
| `frontend/src/App.jsx` | Nested routes under `ProtectedRoute` + `MainLayout`. Sibling pages use relative paths (`analytics`, `journal`, …). Catch-all `*` → `/`. |
| `ProtectedRoute.jsx` | Redirects unauthenticated users to `/login` with `state.from`. Session boot shows `Loader`. |
| Absolute URL | `/ai-insights` will work as `<Route path="ai-insights" …>` under the protected layout (same pattern as `/analytics`). |

### Navigation
| Asset | Finding |
|-------|---------|
| `Sidebar.jsx` | Static `navItems` array: `{ to, label, icon, end? }` + Lucide + `NavLink` `is-active`. |
| Current items | Dashboard, Habit Management, Calendar, Analytics, Goals, Journal, Settings. |
| Design rule | Add one item only; do **not** restyle sidebar chrome or promo card. |

**Proposed nav entry:** `{ to: '/ai-insights', label: 'AI Insights', icon: Sparkles }` (or `Brain`) placed after Journal and before Settings.

### Page composition conventions
Inspected Dashboard, Analytics, Goals, Journal:

- Page root: `*-page` / `dashboard` wrapper with vertical `gap: 16px`.
- Header: 48px icon tile (`--light-blue` / `--primary-blue`) + `h1` + short subtitle; often `PageHeaderTools`.
- Content: `.card` sections, error banners, `EmptyState`, Lucide icons.
- CSS: page-local CSS files; CSS variables (`--primary-text`, `--secondary-text`, `--primary-blue`, `--card-bg`); no global theme rewrite.
- Toasts / banners: page- or component-local (Goals/Journal toast pattern; AI components already toast/banner).

**AI Insights page should mirror Analytics/Goals header + stacked card sections**, not invent a new visual language.

### AI API integration (already done – Stages C/D)
| Layer | Path | Status |
|-------|------|--------|
| Client | `services/api/aiApi.js` | `habitSuggestions()`, `moodAnalysis()` via shared `apiClient` |
| Mappers | `services/api/aiMappers.js` | Habit + mood mappers; `suggestionToHabitPayload`; date validation |
| Habit UI | `components/ai/HabitSuggestions.jsx` | Generate / loading / error+Retry / Add Habit / duplicate guard |
| Journal UI | `components/ai/JournalMoodAnalysis.jsx` | Date range / Analyse / loading / error+Retry / full result grid |
| Backend | `POST /ai/habit-suggestions`, `POST /ai/mood-analysis` | JWT · Gemini · no persist |

**No duplicate Axios instance. No frontend Gemini key. No new backend AI services planned.**

### HabitContext
`HabitSuggestions` already calls `addHabit` + local duplicate checks. Page composition does not need a second habit create path.

---

## 2. Existing component analysis

### `HabitSuggestions.jsx` — reuse directly
Already satisfies Stage E Section B:
- Manual generate only (no fetch on mount).
- Shows name, description, category, frequency, reason, start date.
- Add Habit → `suggestionToHabitPayload` → `HabitContext.addHabit`.
- Loading / error+Retry / empty / disable after add / `addingKey` guard.

**Likely Stage E tweaks (minimal, only if needed):**
- Optional `id="ai-habit-suggestions"` for overview shortcut scroll/hash.
- Stronger long-wait copy (e.g. “This can take up to 90 seconds…”).
- Ensure regenerate clears prior `addedKeys` when new suggestions arrive (verify during impl).

### `JournalMoodAnalysis.jsx` — reuse directly
Already satisfies Stage E Section C:
- Date inputs + client validation via `toMoodAnalysisPayload`.
- No auto-analysis on mount.
- Displays overall mood, summary, positive/challenging patterns, motivation, observations, areas, recommendations.
- Empty state mentions ≥3 journal entries.
- Error+Retry; loading blocks duplicate runs.

**Likely Stage E tweaks (minimal):**
- Optional `id="ai-journal-analysis"` for overview shortcuts.
- Button label alignment: “Analyze My Journal” (prompt) vs current “Analyse Journal” — prefer product copy consistency; British/American spelling already mixed in app; match Stage E prompt wording on the primary CTA.
- Long-wait loading message for 60–90s Gemini latency.
- Ensure all result headings remain visible when lists are empty (optional: show “None identified” vs hide `ListBlock` — current hide-empty is fine; do not invent content).

### Optional small presentational helper
`components/ai/AIInsightCard.jsx` — only if overview shortcuts need a shared card shell matching Goals/Dashboard cards. If page-local markup is cleaner, skip the extra file (prefer fewer files).

---

## 3. Existing API integration analysis

| Concern | Approach |
|---------|----------|
| Habit suggestions | Page embeds `<HabitSuggestions />`; component owns `aiApi.habitSuggestions` |
| Mood analysis | Page embeds `<JournalMoodAnalysis />`; component owns `aiApi.moodAnalysis` |
| Recommendations | **Not a third API** — journal analysis already returns `recommendations[]`; overview section describes capability; habit suggestions’ `reason` fields are the habit-side guidance |
| Auth | Existing JWT on `apiClient`; route behind `ProtectedRoute` |
| Errors 429/502/503/504 | Already surfaced as thrown messages → component banners + Retry |
| Backend changes | **None expected.** Only if a live integration bug is proven; then document, preserve behavior, add regression tests |

---

## 4. Files to create

| File | Purpose |
|------|---------|
| `frontend/src/pages/AIInsights/AIInsights.jsx` | Page composition: overview + HabitSuggestions + JournalMoodAnalysis |
| `frontend/src/pages/AIInsights/AIInsights.css` | Page layout/header/overview grid; match Analytics/Goals tokens |
| `frontend/scripts/verifyAiInsightsPage.mjs` | Smoke: route exists in build/bundle or lightweight API+mapper+nav contract checks consistent with other verify scripts |
| `docs/PHASE_E_AI_INSIGHTS_IMPLEMENTATION_PLAN.md` | This plan (created in audit) |

Optional:
| `frontend/src/components/ai/AIInsightCard.jsx` (+ CSS) | Only if overview shortcut cards need a shared component |

---

## 5. Files to modify

| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Import `AIInsights`; add `<Route path="ai-insights" element={<AIInsights />} />` before catch-all |
| `frontend/src/components/layout/Sidebar.jsx` | Add Lucide icon import + one `navItems` entry |
| `frontend/src/components/ai/HabitSuggestions.jsx` / `.css` | Minimal: section `id`, long-wait copy, regenerate/`addedKeys` polish if needed |
| `frontend/src/components/ai/JournalMoodAnalysis.jsx` / `.css` | Minimal: section `id`, CTA label, long-wait copy |
| `docs/AI_FEATURES_IMPLEMENTATION_PLAN.md` | Mark Stage E done after impl; document route/nav/reuse |

**Do not modify:** backend AI services/endpoints, auth, DB schemas, journal CRUD, habit CRUD, unrelated pages.

---

## 6. Routing and navigation changes

1. **Route:** `/ai-insights` under protected `MainLayout`.
2. **Sidebar:** label `AI Insights`, icon `Sparkles` (preferred) or `Brain`, after Journal.
3. **Auth:** inherits `ProtectedRoute` — unauthenticated → `/login`.
4. **Active state:** `NavLink` `is-active` for `/ai-insights`.
5. **Direct URL / refresh:** same as other SPA routes (Vite history fallback unchanged).
6. **Existing routes:** untouched.

Overview shortcuts (in-page only):
- Buttons/links scroll to `#ai-habit-suggestions` and `#ai-journal-analysis` (no fake metrics).

---

## 7. UI implementation plan

### Page shell (`AIInsights.jsx`)
```
.ai-insights-page
  header (Sparkles icon + “AI Insights” + short subtitle + PageHeaderTools)
  Section A – Overview card
  Section B – <HabitSuggestions />
  Section C – <JournalMoodAnalysis />
```

### Section A – AI Overview
- Heading: **Your Personal AI Growth Assistant**
- Description: *Discover personalized habits, understand your motivation and turn your daily progress into meaningful improvements.*
- Capability bullets (static, honest): Habit Suggestions · Journal Mood Analysis · Practical recommendations from analysis (not fabricated live stats).
- Two shortcut controls → scroll to Sections B/C.
- **No** invented completion rates, fake insight counts, or auto-generated content on load.

### Section B / C
- Embed existing components as primary content cards.
- Page CSS provides vertical rhythm; component CSS stays authoritative for internal layout.

### UX states (owned by child components; page does not auto-trigger AI)
| State | Behavior |
|-------|----------|
| Loading | Clear “may take up to ~90 seconds” message; disable duplicate submit |
| Error | Banner + Retry; map 429/502/503/504 messages from API client |
| Empty | Explain generate / need ≥3 journal entries |
| Success | Render validated API data only |

### Responsive
- Stack sections on narrow viewports; reuse flex/grid patterns from Goals/Analytics.
- Touch-friendly date inputs and buttons.

---

## 8. Error handling

| Source | Handling |
|--------|----------|
| Network / Gemini timeout 504 | Existing API error message + Retry |
| Rate limit 429 | Same |
| AI not configured 503 | Same |
| Invalid AI / upstream 502 | Same |
| Invalid dates | Client `toMoodAnalysisPayload` + backend 422 |
| Insufficient journal | Backend 400 → banner text; no fabricated analysis |
| Habit add failure | Existing `alert` / toast in HabitSuggestions |
| Auth expiry | Existing `apiClient` refresh / logout behavior |

No automatic uncontrolled retries at page or component level.

---

## 9. Testing strategy

### During / after implementation
| Layer | Action |
|-------|--------|
| Backend regression | `python -m pytest` — expect **≥ 181** (no intentional backend deltas) |
| AI pytest slice | habit + journal + gemini still pass |
| Frontend build | `npm run build` |
| Existing smokes | `verifyAiHabitSuggestions.mjs`, `verifyAiJournalAnalysis.mjs` |
| New smoke | `verifyAiInsightsPage.mjs` — confirm route wiring contract (e.g. App export path / static checks) + optionally hit APIs with auth like other scripts |
| Manual | Sidebar → AI Insights; direct `/ai-insights`; refresh; logged-out redirect; generate suggestions; add habit; journal analyze with valid/invalid/insufficient cases |

### Explicit non-claims
- Mocked pytest ≠ live Gemini success.
- Smoke “graceful 502/504” ≠ successful live analysis.
- Live Gemini only reported if a real call succeeds or fails with observed status.

### Out of scope for Stage E tests
- PDF export, Google Calendar, journal CRUD changes, destructive DB wipes.

---

## 10. Potential risks

| Risk | Mitigation |
|------|------------|
| Gemini 60–90s latency / 504 | Clear loading copy; single in-flight request; Retry only |
| Local uvicorn stale without new frontend route | Frontend-only; restart Vite if HMR misses; backend restart only if API stale |
| Overview looks like fake “AI dashboard stats” | Static capability copy only; no random numbers |
| Sidebar clutter | Single nav item; no redesign |
| `addedKeys` stale after regenerate | Clear set when new suggestions load |
| Accidental backend churn | Freeze backend unless proven bug |
| Scope creep into Stage F/G extras | Page composition + nav only; no PDF/Calendar |

---

## 11. Implementation sequence (after approval)

1. Create `AIInsights.jsx` + `AIInsights.css` (header + overview + compose children).
2. Wire `App.jsx` route `ai-insights`.
3. Add Sidebar nav item + Lucide icon.
4. Minimal polish on HabitSuggestions / JournalMoodAnalysis (`id`, wait copy, CTA label).
5. Add `verifyAiInsightsPage.mjs` if useful.
6. Run build + AI smokes + full pytest; manual nav/auth checks.
7. Update `docs/AI_FEATURES_IMPLEMENTATION_PLAN.md` + this plan’s status to **Done**.
8. Deliver Stage E implementation report → **STOP**.

---

## 12. Backend stance

**No backend work planned for Stage E.**

If a genuine integration bug appears (e.g. envelope shape mismatch):
1. Document why.
2. Touch only the minimal file(s).
3. Preserve behavior for existing clients.
4. Add/adjust regression tests.
5. Note in the Stage E report.

---

## 13. Security (unchanged)

- No `GEMINI_API_KEY` in frontend.
- JWT required for page and APIs.
- No cross-user journal access (backend already scoped).
- No new persistence of AI output.
- No hardcoded tokens.

---

## 14. Out of scope

- PDF export  
- Google Calendar  
- New Gemini endpoints  
- AI Insights redesign of Dashboard/Analytics  
- Auto-run AI on page load  
- Storing analysis results  
- Clinical/diagnostic language  

---

## 15. Implementation outcome

Implemented per approved sequence: `AIInsights` page, `/ai-insights` route, Sidebar `Sparkles` item, compose existing AI components, overview shortcuts, long-wait/CTA polish, `verifyAiInsightsPage.mjs`.

**STOP after Stage E.** Do not start Stage F until explicitly approved.
