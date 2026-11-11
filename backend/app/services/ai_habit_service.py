"""AI habit suggestions — uses existing habit/goal services + Gemini."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, List, Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.user import User
from app.schemas.ai import (
    HabitSuggestionItem,
    HabitSuggestionsData,
    HabitSuggestionsLLMResponse,
)
from app.schemas.habit import HABIT_CATEGORIES
from app.services import gemini_service, goal_service, habit_service
from app.services.gemini_service import (
    GeminiAPIError,
    GeminiInvalidResponseError,
    GeminiNotConfiguredError,
    GeminiRateLimitError,
)


def _normalize_name(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", (name or "").strip().lower())
    return cleaned


def _is_duplicate_name(candidate: str, existing: Sequence[str]) -> bool:
    cand = _normalize_name(candidate)
    if not cand:
        return True
    for name in existing:
        other = _normalize_name(name)
        if not other:
            continue
        if cand == other:
            return True
        # Near-duplicate: one contains the other when both reasonably long.
        if len(cand) >= 4 and len(other) >= 4 and (cand in other or other in cand):
            return True
    return False


def _habit_summaries(db: Session, user: User) -> List[dict[str, Any]]:
    data = habit_service.list_habits(
        db,
        user,
        status_filter="active",
        page=1,
        page_size=100,
    )
    return [
        {
            "name": h.name,
            "category": h.category,
            "frequency": h.frequency,
            "description": (h.description or "")[:240],
        }
        for h in data.items
    ]


def _goal_summaries(db: Session, user: User) -> List[dict[str, Any]]:
    data = goal_service.list_goals(
        db,
        user,
        archived=False,
        page=1,
        page_size=100,
    )
    active_statuses = {"not_started", "in_progress", "overdue"}
    rows = []
    for g in data.items:
        if g.status not in active_statuses:
            continue
        rows.append(
            {
                "name": g.name,
                "category": g.category,
                "status": g.status,
                "target_type": g.target_type,
                "description": (g.description or "")[:240],
            }
        )
    return rows


def _build_prompt(
    habits: Sequence[dict[str, Any]],
    goals: Sequence[dict[str, Any]],
    *,
    count: int,
    today: str,
) -> str:
    categories = ", ".join(HABIT_CATEGORIES)
    habit_lines = (
        "\n".join(
            f"- {h['name']} ({h['category']}, {h['frequency']}): {h['description']}"
            for h in habits
        )
        or "- (none yet)"
    )
    goal_lines = (
        "\n".join(
            f"- {g['name']} [{g['status']}] ({g['category']}, {g['target_type']}): "
            f"{g['description']}"
            for g in goals
        )
        or "- (none yet)"
    )
    return f"""You are Habit Hero's AI Habit Coach.

Today's date: {today}

Existing active habits:
{habit_lines}

Active goals:
{goal_lines}

Task:
Suggest exactly {count} practical, achievable new habits for this user.
Avoid duplicates or near-duplicates of existing habit names.
Prefer habits that support the user's goals when possible.
Keep each habit small and realistic (not extreme routines).

Rules:
- category MUST be one of: {categories}
- frequency MUST be exactly "Daily" or "Weekly"
- recommended_start_date MUST be YYYY-MM-DD (today or within the next 7 days)
- Provide a short reason tied to the user's context
- Return structured JSON matching the schema (suggestions array only)
"""


def _map_gemini_error(exc: Exception) -> HTTPException:
    if isinstance(exc, GeminiNotConfiguredError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features are not configured. Set GEMINI_API_KEY on the server.",
        )
    if isinstance(exc, GeminiRateLimitError):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI rate limit reached. Please try again later.",
        )
    if isinstance(exc, GeminiInvalidResponseError):
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an invalid response. Please try again.",
        )
    if isinstance(exc, GeminiAPIError):
        msg = str(exc)
        if "timed out" in msg.lower():
            return HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="AI request timed out. Please try again in a moment.",
            )
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI service is temporarily unavailable. Please try again.",
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AI service is temporarily unavailable. Please try again.",
    )


def generate_habit_suggestions(
    db: Session,
    user: User,
    *,
    count: int = 5,
    app_settings: Optional[Settings] = None,
    client: Any = None,
) -> HabitSuggestionsData:
    """
    Produce up to ``count`` habit suggestions for the authenticated user.

    Uses existing habit/goal list services. Does not persist suggestions.
    """
    cfg = app_settings or get_settings()
    if not gemini_service.is_configured(cfg) and client is None:
        raise _map_gemini_error(GeminiNotConfiguredError("missing key"))

    count = max(1, min(int(count or 5), 5))
    habits = _habit_summaries(db, user)
    goals = _goal_summaries(db, user)
    existing_names = [h["name"] for h in habits]
    today = date.today().isoformat()
    prompt = _build_prompt(habits, goals, count=count, today=today)

    try:
        raw = gemini_service.generate_json(
            prompt,
            response_schema=HabitSuggestionsLLMResponse,
            app_settings=cfg,
            client=client,
        )
    except (
        GeminiNotConfiguredError,
        GeminiRateLimitError,
        GeminiInvalidResponseError,
        GeminiAPIError,
    ) as exc:
        raise _map_gemini_error(exc) from exc

    if not isinstance(raw, HabitSuggestionsLLMResponse):
        try:
            raw = HabitSuggestionsLLMResponse.model_validate(raw)
        except Exception as exc:
            raise _map_gemini_error(
                GeminiInvalidResponseError("schema mismatch")
            ) from exc

    accepted: List[HabitSuggestionItem] = []
    seen: List[str] = list(existing_names)

    for item in raw.suggestions:
        try:
            suggestion = HabitSuggestionItem.model_validate(item)
        except Exception:
            continue
        if _is_duplicate_name(suggestion.name, seen):
            continue
        accepted.append(suggestion)
        seen.append(suggestion.name)
        if len(accepted) >= count:
            break

    if not accepted:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI could not produce usable habit suggestions. Please try again.",
        )

    return HabitSuggestionsData(suggestions=accepted, count=len(accepted))
