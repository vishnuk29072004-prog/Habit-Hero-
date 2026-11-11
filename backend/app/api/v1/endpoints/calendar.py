from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.calendar import (
    CalendarSummaryResponse,
    DailyCalendarResponse,
    DayNoteApiResponse,
    DayNoteCreate,
    DayNoteDeleteResponse,
    DayNoteListResponse,
    DayNoteResponse,
    DayNoteUpdate,
    MonthlyCalendarResponse,
)
from app.services import calendar_service, day_note_service
from app.utils.date_keys import parse_date_key

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get(
    "/monthly",
    response_model=MonthlyCalendarResponse,
    summary="Monthly calendar overview",
)
def monthly_calendar(
    current_user: CurrentUser,
    db: DbSession,
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=1970, le=2100),
) -> MonthlyCalendarResponse:
    data = calendar_service.get_monthly_summary(
        db, current_user, year=year, month=month
    )
    return MonthlyCalendarResponse(
        success=True,
        message="Monthly calendar retrieved successfully",
        data=data,
    )


@router.get(
    "/daily",
    response_model=DailyCalendarResponse,
    summary="Daily calendar habits",
)
def daily_calendar(
    current_user: CurrentUser,
    db: DbSession,
    date: str = Query(..., description="YYYY-MM-DD"),
) -> DailyCalendarResponse:
    date_key = parse_date_key(date).isoformat()
    data = calendar_service.get_daily_summary(db, current_user, date_key)
    return DailyCalendarResponse(
        success=True,
        message="Daily calendar retrieved successfully",
        data=data,
    )


@router.get(
    "/summary",
    response_model=CalendarSummaryResponse,
    summary="Date-range calendar summary",
)
def calendar_summary(
    current_user: CurrentUser,
    db: DbSession,
    start_date: str = Query(...),
    end_date: str = Query(...),
) -> CalendarSummaryResponse:
    start = parse_date_key(start_date).isoformat()
    end = parse_date_key(end_date).isoformat()
    data = calendar_service.get_date_range_summary(
        db, current_user, start_date=start, end_date=end
    )
    return CalendarSummaryResponse(
        success=True,
        message="Calendar summary retrieved successfully",
        data=data,
    )


@router.get(
    "/notes",
    response_model=DayNoteListResponse,
    summary="List day notes",
)
def list_day_notes(
    current_user: CurrentUser,
    db: DbSession,
    date: Optional[str] = Query(None, description="Exact YYYY-MM-DD"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> DayNoteListResponse:
    rows = day_note_service.list_notes(
        db,
        current_user,
        date_key=date,
        start_date=parse_date_key(start_date).isoformat() if start_date else None,
        end_date=parse_date_key(end_date).isoformat() if end_date else None,
    )
    return DayNoteListResponse(
        success=True,
        message="Day notes retrieved successfully",
        data=[DayNoteResponse.model_validate(r) for r in rows],
    )


@router.post(
    "/notes",
    response_model=DayNoteApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create day note",
)
def create_day_note(
    payload: DayNoteCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> DayNoteApiResponse:
    row = day_note_service.create_note(db, current_user, payload)
    return DayNoteApiResponse(
        success=True,
        message="Day note created successfully",
        data=DayNoteResponse.model_validate(row),
    )


@router.patch(
    "/notes/{note_id}",
    response_model=DayNoteApiResponse,
    summary="Update day note",
)
def update_day_note(
    note_id: int,
    payload: DayNoteUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> DayNoteApiResponse:
    row = day_note_service.update_note(db, current_user, note_id, payload)
    return DayNoteApiResponse(
        success=True,
        message="Day note updated successfully",
        data=DayNoteResponse.model_validate(row),
    )


@router.delete(
    "/notes/{note_id}",
    response_model=DayNoteDeleteResponse,
    summary="Delete day note",
)
def delete_day_note(
    note_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> DayNoteDeleteResponse:
    deleted_id = day_note_service.delete_note(db, current_user, note_id)
    return DayNoteDeleteResponse(
        success=True,
        message="Day note deleted successfully",
        data={"id": deleted_id, "deleted": True},
    )
