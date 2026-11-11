from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.habit import (
    HabitApiResponse,
    HabitCreate,
    HabitDeleteData,
    HabitDeleteResponse,
    HabitListResponse,
    HabitUpdate,
    StatusFilter,
)
from app.services import habit_service

router = APIRouter(prefix="/habits", tags=["habits"])


@router.post(
    "",
    response_model=HabitApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create habit",
)
def create_habit(
    payload: HabitCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitApiResponse:
    habit = habit_service.create_habit(db, current_user, payload)
    return HabitApiResponse(
        success=True,
        message="Habit created successfully",
        data=habit_service.to_habit_response(habit),
    )


@router.get(
    "",
    response_model=HabitListResponse,
    summary="List habits",
)
def list_habits(
    current_user: CurrentUser,
    db: DbSession,
    status: StatusFilter = Query(
        "all",
        description="Filter by status: active, archived, or all",
    ),
    category: Optional[str] = Query(None, description="Exact category filter"),
    frequency: Optional[str] = Query(None, description="Daily or Weekly"),
    search: Optional[str] = Query(None, description="Case-insensitive name search"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> HabitListResponse:
    data = habit_service.list_habits(
        db,
        current_user,
        status_filter=status,
        category=category,
        frequency=frequency,
        search=search,
        page=page,
        page_size=page_size,
    )
    return HabitListResponse(
        success=True,
        message="Habits retrieved successfully",
        data=data,
    )


@router.get(
    "/{habit_id}",
    response_model=HabitApiResponse,
    summary="Get habit details",
)
def get_habit(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitApiResponse:
    habit = habit_service.get_habit_by_id(db, current_user, habit_id)
    return HabitApiResponse(
        success=True,
        message="Habit retrieved successfully",
        data=habit_service.to_habit_response(habit),
    )


@router.patch(
    "/{habit_id}",
    response_model=HabitApiResponse,
    summary="Update habit",
)
def update_habit(
    habit_id: str,
    payload: HabitUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitApiResponse:
    habit = habit_service.update_habit(db, current_user, habit_id, payload)
    return HabitApiResponse(
        success=True,
        message="Habit updated successfully",
        data=habit_service.to_habit_response(habit),
    )


@router.delete(
    "/{habit_id}",
    response_model=HabitDeleteResponse,
    summary="Delete habit (archives when history exists)",
)
def delete_habit(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitDeleteResponse:
    habit, action = habit_service.delete_habit(db, current_user, habit_id)
    if action == "archived":
        assert habit is not None
        return HabitDeleteResponse(
            success=True,
            message=(
                "Habit archived instead of deleted to preserve "
                "historical check-ins, goals, or journal links"
            ),
            data=HabitDeleteData(
                id=habit.id,
                action="archived",
                habit=habit_service.to_habit_response(habit),
            ),
        )
    return HabitDeleteResponse(
        success=True,
        message="Habit deleted successfully",
        data=HabitDeleteData(id=habit_id, action="deleted", habit=None),
    )


@router.patch(
    "/{habit_id}/archive",
    response_model=HabitApiResponse,
    summary="Archive habit",
)
def archive_habit(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitApiResponse:
    habit = habit_service.archive_habit(db, current_user, habit_id)
    return HabitApiResponse(
        success=True,
        message="Habit archived successfully",
        data=habit_service.to_habit_response(habit),
    )


@router.patch(
    "/{habit_id}/restore",
    response_model=HabitApiResponse,
    summary="Restore archived habit",
)
def restore_habit(
    habit_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> HabitApiResponse:
    habit = habit_service.restore_habit(db, current_user, habit_id)
    return HabitApiResponse(
        success=True,
        message="Habit restored successfully",
        data=habit_service.to_habit_response(habit),
    )
