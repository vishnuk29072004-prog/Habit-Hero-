from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.ai import (
    HabitSuggestionsApiResponse,
    HabitSuggestionsRequest,
    MoodAnalysisApiResponse,
    MoodAnalysisRequest,
)
from app.services import ai_habit_service, ai_journal_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/habit-suggestions",
    response_model=HabitSuggestionsApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI habit suggestions",
)
def create_habit_suggestions(
    current_user: CurrentUser,
    db: DbSession,
    payload: HabitSuggestionsRequest = HabitSuggestionsRequest(),
) -> HabitSuggestionsApiResponse:
    data = ai_habit_service.generate_habit_suggestions(
        db,
        current_user,
        count=payload.count,
    )
    return HabitSuggestionsApiResponse(
        success=True,
        message="Habit suggestions generated successfully",
        data=data,
    )


@router.post(
    "/mood-analysis",
    response_model=MoodAnalysisApiResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyse journal mood and motivation",
)
def create_mood_analysis(
    payload: MoodAnalysisRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> MoodAnalysisApiResponse:
    data = ai_journal_service.analyze_mood(
        db,
        current_user,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    return MoodAnalysisApiResponse(
        success=True,
        message="Journal mood analysis generated successfully",
        data=data,
    )
