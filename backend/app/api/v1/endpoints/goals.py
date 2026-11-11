from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.goal import (
    GoalApiResponse,
    GoalCreate,
    GoalDeleteResponse,
    GoalListResponse,
    GoalSummaryResponse,
    GoalUpdate,
)
from app.services import goal_service

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post(
    "",
    response_model=GoalApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create goal",
)
def create_goal(
    payload: GoalCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalApiResponse:
    data = goal_service.create_goal(db, current_user, payload)
    return GoalApiResponse(
        success=True, message="Goal created successfully", data=data
    )


@router.get("", response_model=GoalListResponse, summary="List goals")
def list_goals(
    current_user: CurrentUser,
    db: DbSession,
    status: Optional[str] = Query(
        None,
        description="archived|completed|overdue|not_started|in_progress",
    ),
    category: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> GoalListResponse:
    data = goal_service.list_goals(
        db,
        current_user,
        status_filter=status,
        category=category,
        archived=archived,
        page=page,
        page_size=page_size,
    )
    return GoalListResponse(
        success=True, message="Goals retrieved successfully", data=data
    )


@router.get(
    "/summary",
    response_model=GoalSummaryResponse,
    summary="Goals summary statistics",
)
def goals_summary(
    current_user: CurrentUser,
    db: DbSession,
) -> GoalSummaryResponse:
    data = goal_service.get_goals_summary(db, current_user)
    return GoalSummaryResponse(
        success=True, message="Goals summary retrieved successfully", data=data
    )


@router.get("/{goal_id}", response_model=GoalApiResponse, summary="Get goal")
def get_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalApiResponse:
    data = goal_service.get_goal(db, current_user, goal_id)
    return GoalApiResponse(
        success=True, message="Goal retrieved successfully", data=data
    )


@router.patch("/{goal_id}", response_model=GoalApiResponse, summary="Update goal")
def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalApiResponse:
    data = goal_service.update_goal(db, current_user, goal_id, payload)
    return GoalApiResponse(
        success=True, message="Goal updated successfully", data=data
    )


@router.delete(
    "/{goal_id}",
    response_model=GoalDeleteResponse,
    summary="Delete goal",
)
def delete_goal(
    goal_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> GoalDeleteResponse:
    deleted_id = goal_service.delete_goal(db, current_user, goal_id)
    return GoalDeleteResponse(
        success=True,
        message="Goal deleted successfully",
        data={"id": deleted_id, "deleted": True},
    )
