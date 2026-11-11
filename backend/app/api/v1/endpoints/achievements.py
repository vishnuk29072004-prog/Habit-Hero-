from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.achievement import (
    AchievementApiResponse,
    AchievementListResponse,
    AchievementSummaryResponse,
)
from app.services import achievement_service

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=AchievementListResponse, summary="List earned achievements")
def list_achievements(
    current_user: CurrentUser,
    db: DbSession,
) -> AchievementListResponse:
    data = achievement_service.list_earned(db, current_user)
    return AchievementListResponse(
        success=True,
        message="Achievements retrieved successfully",
        data=data,
    )


@router.get(
    "/summary",
    response_model=AchievementSummaryResponse,
    summary="Achievement summary and catalogue",
)
def achievements_summary(
    current_user: CurrentUser,
    db: DbSession,
) -> AchievementSummaryResponse:
    data = achievement_service.get_summary(db, current_user)
    return AchievementSummaryResponse(
        success=True,
        message="Achievement summary retrieved successfully",
        data=data,
    )


@router.get(
    "/{achievement_id}",
    response_model=AchievementApiResponse,
    summary="Get earned achievement",
)
def get_achievement(
    achievement_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> AchievementApiResponse:
    data = achievement_service.get_earned(db, current_user, achievement_id)
    return AchievementApiResponse(
        success=True,
        message="Achievement retrieved successfully",
        data=data,
    )
