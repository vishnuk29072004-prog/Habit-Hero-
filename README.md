# Habit Hero

Premium habit-tracking application with React frontend and FastAPI backend.

## Features

- Authentication (JWT access + refresh)
- Profile, avatar, and user settings
- Habit CRUD with Daily / Weekly schedules
- Check-ins and calendar views
- Analytics, streaks, and category insights
- Goals and achievements
- Journal with moods and tags
- Notifications / reminders
- **AI Insights** (Gemini): habit suggestions + journal mood analysis
- **PDF Progress Export** (ReportLab)
- **Google Calendar sync** (OAuth, encrypted tokens)

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React, Vite, React Router, Context API, Axios, Lucide |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, SQLite, JWT |
| AI | google-genai (Gemini) |
| PDF | ReportLab |
| Calendar | Google Calendar API (OAuth 2.0) |

## Architecture

```
frontend/  → Vite SPA (port 5173) → /api/v1 via VITE_API_BASE_URL
backend/   → FastAPI (port 8000) + SQLite habit_hero.db
```

Habit Hero is the source of truth for habits. Google Calendar receives synced recurring events; AI analysis and PDFs are generated on demand and not permanently stored (except Google OAuth tokens encrypted at rest).

## Folder structure

```
Habit_Tracker/
  frontend/          React app
  backend/           FastAPI app
  docs/              Implementation & validation docs
  README.md          This file
```

## Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env — set SECRET_KEY and optional integrations
$env:PYTHONPATH = (Get-Location).Path
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health: http://127.0.0.1:8000/api/v1/health  
Swagger: http://127.0.0.1:8000/docs

## Frontend setup

```powershell
cd frontend
npm install
# Ensure VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
npm run dev
```

App: http://localhost:5173

## Environment variables (backend `.env`)

Never commit real secrets. See `backend/.env.example`.

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing |
| `DATABASE_URL` | SQLite URL |
| `CORS_ORIGINS` | Allowed frontend origins |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | AI features |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar OAuth |
| `TOKEN_ENCRYPTION_KEY` | Fernet key for OAuth token encryption |
| `FRONTEND_APP_URL` | Post-OAuth redirect target |

Generate a Fernet key:

```powershell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Google Calendar

1. Enable Google Calendar API in Google Cloud.
2. Create OAuth Web client credentials.
3. Add redirect URI matching `GOOGLE_REDIRECT_URI` (default `http://127.0.0.1:8000/api/v1/calendar/google/callback`).
4. Set env vars and restart the API.
5. In the app: **Settings → Connect Google Calendar → Sync Now**.

Endpoints (JWT required except callback):

- `GET /api/v1/calendar/google/status`
- `GET /api/v1/calendar/google/connect`
- `GET /api/v1/calendar/google/callback`
- `POST /api/v1/calendar/google/sync`
- `POST /api/v1/calendar/google/disconnect`
- `GET /api/v1/calendar/google/events`

## PDF Export

`GET /api/v1/reports/progress/pdf?start_date=&end_date=`  
UI: Analytics → Export Report.

## AI features

UI: **AI Insights** (`/ai-insights`). Requires `GEMINI_API_KEY`. Does not call Gemini on page load.

## Testing

```powershell
# Backend
cd backend
$env:PYTHONPATH = (Get-Location).Path
python -m pytest

# Frontend
cd frontend
npm run build
node scripts/verifyAiHabitSuggestions.mjs
node scripts/verifyAiJournalAnalysis.mjs
node scripts/verifyAiInsightsPage.mjs
node scripts/verifyPdfExport.mjs
node scripts/verifyGoogleCalendar.mjs
```

## Known limitations

- Live Gemini calls may time out (~60–90s / 504).
- Google Calendar live OAuth requires valid Cloud credentials and user consent.
- AI results and PDFs are ephemeral (not archived in DB).
- Notification scheduler is off by default.

## Documentation

- `backend/README.md` — detailed API notes
- `docs/` — stage plans and `FINAL_PROJECT_VALIDATION_REPORT.md`
