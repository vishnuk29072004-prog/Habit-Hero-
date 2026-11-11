from typing import Optional

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbSession
from app.schemas.analytics import (
    AnalyticsApiResponse,
    BestDaysData,
    CategoryAnalyticsData,
    HabitAnalyticsData,
    MonthlyAnalyticsData,
    OverviewAnalytics,
    StreakAnalyticsData,
    WeeklyAnalyticsData,
)
from app.services import analytics_service
from app.utils.date_keys import parse_date_key

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _ok(message: str, data) -> AnalyticsApiResponse:
    return AnalyticsApiResponse(success=True, message=message, data=data)


@router.get("/overview", response_model=AnalyticsApiResponse, summary="Dashboard analytics overview")
def analytics_overview(
    current_user: CurrentUser,
    db: DbSession,
) -> AnalyticsApiResponse:
    data: OverviewAnalytics = analytics_service.get_overview(db, current_user)
    return _ok("Analytics overview retrieved successfully", data)


@router.get(
    "/habits/{habit_id}",
    response_model=AnalyticsApiResponse,
    summary="Individual habit analytics",
)
def habit_analytics(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> AnalyticsApiResponse:
    start = parse_date_key(start_date).isoformat() if start_date else None
    end = parse_date_key(end_date).isoformat() if end_date else None
    data: HabitAnalyticsData = analytics_service.get_habit_analytics(
        db, current_user, habit_id, start_date=start, end_date=end
    )
    return _ok("Habit analytics retrieved successfully", data)


@router.get("/weekly", response_model=AnalyticsApiResponse, summary="Weekly analytics")
def weekly_analytics(
    current_user: CurrentUser,
    db: DbSession,
    date: Optional[str] = Query(
        None, description="Any date within the requested week (YYYY-MM-DD)"
    ),
) -> AnalyticsApiResponse:
    anchor = parse_date_key(date).isoformat() if date else None
    data: WeeklyAnalyticsData = analytics_service.get_weekly_analytics(
        db, current_user, date=anchor
    )
    return _ok("Weekly analytics retrieved successfully", data)


@router.get("/monthly", response_model=AnalyticsApiResponse, summary="Monthly analytics")
def monthly_analytics(
    current_user: CurrentUser,
    db: DbSession,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1970, le=2100),
) -> AnalyticsApiResponse:
    data: MonthlyAnalyticsData = analytics_service.get_monthly_analytics(
        db, current_user, month=month, year=year
    )
    return _ok("Monthly analytics retrieved successfully", data)


@router.get(
    "/categories",
    response_model=AnalyticsApiResponse,
    summary="Category performance analytics",
)
def category_analytics(
    current_user: CurrentUser,
    db: DbSession,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> AnalyticsApiResponse:
    start = parse_date_key(start_date).isoformat() if start_date else None
    end = parse_date_key(end_date).isoformat() if end_date else None
    data: CategoryAnalyticsData = analytics_service.get_category_analytics(
        db, current_user, start_date=start, end_date=end
    )
    return _ok("Category analytics retrieved successfully", data)


@router.get(
    "/best-days",
    response_model=AnalyticsApiResponse,
    summary="Best weekdays by completion rate",
)
def best_days_analytics(
    current_user: CurrentUser,
    db: DbSession,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> AnalyticsApiResponse:
    start = parse_date_key(start_date).isoformat() if start_date else None
    end = parse_date_key(end_date).isoformat() if end_date else None
    data: BestDaysData = analytics_service.get_best_days(
        db, current_user, start_date=start, end_date=end
    )
    return _ok("Best-days analytics retrieved successfully", data)


@router.get("/streaks", response_model=AnalyticsApiResponse, summary="Streak analytics")
def streak_analytics(
    current_user: CurrentUser,
    db: DbSession,
) -> AnalyticsApiResponse:
    data: StreakAnalyticsData = analytics_service.get_streak_analytics(
        db, current_user
    )
    return _ok("Streak analytics retrieved successfully", data)
