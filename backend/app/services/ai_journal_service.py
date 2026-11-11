"""AI journal mood & motivation analysis — uses journal_service + Gemini."""

from __future__ import annotations

from typing import Any, List, Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.user import User
from app.schemas.ai import (
    MIN_JOURNAL_ENTRIES_FOR_ANALYSIS,
    AnalysisPeriod,
    MoodAnalysisData,
    MoodAnalysisLLMResponse,
)
from app.schemas.journal import JOURNAL_MOODS, JournalResponse
from app.services import gemini_service, journal_service
from app.services.ai_habit_service import _map_gemini_error
from app.services.gemini_service import (
    GeminiAPIError,
    GeminiInvalidResponseError,
    GeminiNotConfiguredError,
    GeminiRateLimitError,
)

# Cap prompt size while staying within journal list page_size limits.
_MAX_ENTRIES_FOR_PROMPT = 100
_CONTENT_SNIPPET = 400


def _fetch_entries(
    db: Session,
    user: User,
    *,
    start_date: str,
    end_date: str,
) -> List[JournalResponse]:
    collected: List[JournalResponse] = []
    page = 1
    total = None
    while True:
        data = journal_service.list_entries(
            db,
            user,
            start_date=start_date,
            end_date=end_date,
            sort="oldest",
            page=page,
            page_size=100,
        )
        if total is None:
            total = data.total
        collected.extend(data.items)
        if len(collected) >= total or not data.items:
            break
        page += 1
        if page > 20:
            break
    return collected[:_MAX_ENTRIES_FOR_PROMPT]


def _entry_lines(entries: Sequence[JournalResponse]) -> str:
    lines = []
    for e in entries:
        tags = ", ".join(e.tags) if e.tags else "(none)"
        content = (e.content or "").strip().replace("\n", " ")
        if len(content) > _CONTENT_SNIPPET:
            content = content[:_CONTENT_SNIPPET].rstrip() + "…"
        title = (e.title or "").strip() or "(untitled)"
        lines.append(
            f"- {e.date} | mood={e.mood} | tags=[{tags}] | "
            f"title={title} | content={content}"
        )
    return "\n".join(lines)


def _build_prompt(
    entries: Sequence[JournalResponse],
    *,
    start_date: str,
    end_date: str,
) -> str:
    moods = ", ".join(JOURNAL_MOODS)
    return f"""You are Habit Hero's wellness reflection coach.

Analysis period: {start_date} to {end_date}
Entries provided: {len(entries)}

Journal entries (date, mood label, tags, title, content snippet):
{_entry_lines(entries)}

Task:
Write a personal wellness reflection based ONLY on these entries.
Identify mood and motivation patterns that are clearly supported by the text and mood labels.

Cover:
1. overall_mood — short plain-language mood for the period
2. mood_summary — brief narrative of how mood shifted
3. mood_patterns.positive — positive mood patterns (list of short strings)
4. mood_patterns.challenging — challenging mood patterns (list of short strings)
5. motivation_patterns — motivation trends (list)
6. positive_observations — supportive observations (list)
7. areas_to_improve — gentle, practical areas (list)
8. recommendations — actionable, realistic tips (list)
9. summary — short overall reflection

Rules:
- Allowed mood labels in the source data: {moods}
- Do NOT invent trends, statistics, or events not present in the entries
- Do NOT diagnose medical or mental-health conditions
- Do NOT use clinical language; keep a supportive wellness tone
- If evidence is thin, say so briefly instead of guessing
- Return structured JSON matching the schema only
"""


def analyze_mood(
    db: Session,
    user: User,
    *,
    start_date: str,
    end_date: str,
    app_settings: Optional[Settings] = None,
    client: Any = None,
) -> MoodAnalysisData:
    """
    Analyse journal entries in ``[start_date, end_date]`` for the user.

    Does not persist results. Requires at least
    ``MIN_JOURNAL_ENTRIES_FOR_ANALYSIS`` entries before calling Gemini.
    """
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must not precede start_date",
        )

    entries = _fetch_entries(
        db, user, start_date=start_date, end_date=end_date
    )
    period = AnalysisPeriod(start_date=start_date, end_date=end_date)

    if len(entries) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No journal entries found in this date range. "
                "Add journal entries, then try again."
            ),
        )

    if len(entries) < MIN_JOURNAL_ENTRIES_FOR_ANALYSIS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"At least {MIN_JOURNAL_ENTRIES_FOR_ANALYSIS} journal entries "
                f"are needed for mood analysis. Found {len(entries)} in this "
                "range. Write a few more reflections, then try again."
            ),
        )

    cfg = app_settings or get_settings()
    if not gemini_service.is_configured(cfg) and client is None:
        raise _map_gemini_error(GeminiNotConfiguredError("missing key"))

    prompt = _build_prompt(
        entries, start_date=start_date, end_date=end_date
    )

    try:
        raw = gemini_service.generate_json(
            prompt,
            response_schema=MoodAnalysisLLMResponse,
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

    if not isinstance(raw, MoodAnalysisLLMResponse):
        try:
            raw = MoodAnalysisLLMResponse.model_validate(raw)
        except Exception as exc:
            raise _map_gemini_error(
                GeminiInvalidResponseError("schema mismatch")
            ) from exc

    if not raw.overall_mood or not raw.summary:
        raise _map_gemini_error(
            GeminiInvalidResponseError("incomplete analysis")
        )

    return MoodAnalysisData(
        overall_mood=raw.overall_mood,
        mood_summary=raw.mood_summary,
        mood_patterns=raw.mood_patterns,
        motivation_patterns=raw.motivation_patterns,
        positive_observations=raw.positive_observations,
        areas_to_improve=raw.areas_to_improve,
        recommendations=raw.recommendations,
        summary=raw.summary,
        entries_analyzed=len(entries),
        analysis_period=period,
    )
