from typing import Optional

from fastapi import APIRouter, Path, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.checkin import (
    CheckinApiResponse,
    CheckinCreate,
    CheckinDeleteResponse,
    CheckinListResponse,
    CheckinUpdate,
)
from app.services import checkin_service
from app.utils.date_keys import parse_date_key

router = APIRouter(prefix="/habits", tags=["checkins"])


@router.post(
    "/{habit_id}/checkins",
    response_model=CheckinApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create habit check-in",
)
def create_checkin(
    habit_id: str,
    payload: CheckinCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> CheckinApiResponse:
    row = checkin_service.create_checkin(db, current_user, habit_id, payload)
    return CheckinApiResponse(
        success=True,
        message="Check-in created successfully",
        data=checkin_service.to_checkin_response(row),
    )


@router.get(
    "/{habit_id}/checkins",
    response_model=CheckinListResponse,
    summary="List habit check-ins",
)
def list_checkins(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(
        None, description="completed or incomplete"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> CheckinListResponse:
    if start_date:
        start_date = parse_date_key(start_date).isoformat()
    if end_date:
        end_date = parse_date_key(end_date).isoformat()
    data = checkin_service.list_checkins(
        db,
        current_user,
        habit_id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
        page=page,
        page_size=page_size,
    )
    return CheckinListResponse(
        success=True,
        message="Check-ins retrieved successfully",
        data=data,
    )


@router.get(
    "/{habit_id}/checkins/{checkin_date}",
    response_model=CheckinApiResponse,
    summary="Get check-in by date",
)
def get_checkin_by_date(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
    checkin_date: str = Path(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> CheckinApiResponse:
    row = checkin_service.get_checkin_by_date(
        db, current_user, habit_id, checkin_date
    )
    return CheckinApiResponse(
        success=True,
        message="Check-in retrieved successfully",
        data=checkin_service.to_checkin_response(row),
    )


@router.patch(
    "/{habit_id}/checkins/{checkin_id}",
    response_model=CheckinApiResponse,
    summary="Update check-in",
)
def update_checkin(
    habit_id: str,
    checkin_id: int,
    payload: CheckinUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> CheckinApiResponse:
    row = checkin_service.update_checkin(
        db, current_user, habit_id, checkin_id, payload
    )
    return CheckinApiResponse(
        success=True,
        message="Check-in updated successfully",
        data=checkin_service.to_checkin_response(row),
    )


@router.delete(
    "/{habit_id}/checkins/{checkin_id}",
    response_model=CheckinDeleteResponse,
    summary="Delete check-in",
)
def delete_checkin(
    habit_id: str,
    checkin_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> CheckinDeleteResponse:
    deleted_id = checkin_service.delete_checkin(
        db, current_user, habit_id, checkin_id
    )
    return CheckinDeleteResponse(
        success=True,
        message="Check-in deleted successfully",
        data={"id": deleted_id, "deleted": True},
    )
