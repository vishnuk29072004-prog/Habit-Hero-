from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.journal import (
    JournalApiResponse,
    JournalCreate,
    JournalDeleteResponse,
    JournalListResponse,
    JournalSummaryResponse,
    JournalUpdate,
)
from app.services import journal_service

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post(
    "",
    response_model=JournalApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create journal entry",
)
def create_journal_entry(
    payload: JournalCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> JournalApiResponse:
    data = journal_service.create_entry(db, current_user, payload)
    return JournalApiResponse(
        success=True, message="Journal entry created successfully", data=data
    )


@router.get("", response_model=JournalListResponse, summary="List journal entries")
def list_journal_entries(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search title, content, tags, habit name"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    mood: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    habit_id: Optional[str] = Query(
        None, description="Habit id, or 'general' for unlinked entries"
    ),
    sort: str = Query("newest", description="newest|oldest"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> JournalListResponse:
    data = journal_service.list_entries(
        db,
        current_user,
        search=search,
        start_date=start_date,
        end_date=end_date,
        mood=mood,
        tag=tag,
        habit_id=habit_id,
        sort=sort,
        page=page,
        page_size=page_size,
    )
    return JournalListResponse(
        success=True, message="Journal entries retrieved successfully", data=data
    )


@router.get(
    "/summary",
    response_model=JournalSummaryResponse,
    summary="Journal summary statistics",
)
def journal_summary(
    current_user: CurrentUser,
    db: DbSession,
    period: str = Query(
        "thisMonth",
        description="thisWeek|thisMonth|lastMonth|thisYear",
    ),
) -> JournalSummaryResponse:
    data = journal_service.get_summary(db, current_user, period=period)
    return JournalSummaryResponse(
        success=True, message="Journal summary retrieved successfully", data=data
    )


@router.get(
    "/{entry_id}",
    response_model=JournalApiResponse,
    summary="Get journal entry",
)
def get_journal_entry(
    entry_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> JournalApiResponse:
    data = journal_service.get_entry(db, current_user, entry_id)
    return JournalApiResponse(
        success=True, message="Journal entry retrieved successfully", data=data
    )


@router.patch(
    "/{entry_id}",
    response_model=JournalApiResponse,
    summary="Update journal entry",
)
def update_journal_entry(
    entry_id: str,
    payload: JournalUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> JournalApiResponse:
    data = journal_service.update_entry(db, current_user, entry_id, payload)
    return JournalApiResponse(
        success=True, message="Journal entry updated successfully", data=data
    )


@router.delete(
    "/{entry_id}",
    response_model=JournalDeleteResponse,
    summary="Delete journal entry",
)
def delete_journal_entry(
    entry_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> JournalDeleteResponse:
    deleted_id = journal_service.delete_entry(db, current_user, entry_id)
    return JournalDeleteResponse(
        success=True,
        message="Journal entry deleted successfully",
        data={"id": deleted_id, "deleted": True},
    )
