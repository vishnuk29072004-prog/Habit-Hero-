# Habit Hero – Stage G: Google Calendar Integration

**Status:** Implemented (mocked tests green; live OAuth pending credentials)  
**Date:** 2026-11-11  

## Findings
- No prior Google Calendar code in the repo.
- Local `backend/.env` currently has no `GOOGLE_*` keys (placeholders will be documented).
- Reuse JWT `CurrentUser`, habit schedule fields (`frequency`, `week_day`, `start_date`), Settings page.

## Design
- OAuth 2.0 auth code + PKCE-less confidential client (server-side secret).
- Scopes: `calendar.events` + `userinfo.email`.
- Tokens encrypted at rest with Fernet (`TOKEN_ENCRYPTION_KEY`).
- Models: `google_calendar_connections`, `habit_google_events`.
- Sync is idempotent via habit↔event mapping; Habit Hero is source of truth.
- No Gemini / PDF changes.

## Env required
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`  
(never commit real values)
