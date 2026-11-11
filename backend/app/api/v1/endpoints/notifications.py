from typing import Optional

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.notification import (
    NotificationApiResponse,
    NotificationGenerateData,
    NotificationGenerateResponse,
    NotificationListResponse,
    NotificationMutateResponse,
    NotificationSummaryResponse,
)
from app.services import notification_generator, notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse, summary="List notifications")
def list_notifications(
    current_user: CurrentUser,
    db: DbSession,
    unread_only: bool = Query(False),
    type: Optional[str] = Query(None, description="Filter by notification type"),
    refresh: bool = Query(
        True,
        description="Regenerate reminders for the current user before listing",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> NotificationListResponse:
    if refresh:
        notification_generator.generate_for_user(db, current_user)
    data = notification_service.list_notifications(
        db,
        current_user,
        unread_only=unread_only,
        type_filter=type,
        page=page,
        page_size=page_size,
    )
    return NotificationListResponse(
        success=True, message="Notifications retrieved successfully", data=data
    )


@router.get(
    "/summary",
    response_model=NotificationSummaryResponse,
    summary="Notification summary",
)
def notifications_summary(
    current_user: CurrentUser,
    db: DbSession,
    refresh: bool = Query(False),
) -> NotificationSummaryResponse:
    if refresh:
        notification_generator.generate_for_user(db, current_user)
    data = notification_service.get_summary(db, current_user)
    return NotificationSummaryResponse(
        success=True, message="Notification summary retrieved successfully", data=data
    )


@router.post(
    "/generate",
    response_model=NotificationGenerateResponse,
    summary="Generate notifications for current user",
)
def generate_notifications(
    current_user: CurrentUser,
    db: DbSession,
) -> NotificationGenerateResponse:
    result = notification_generator.generate_for_user(db, current_user)
    return NotificationGenerateResponse(
        success=True,
        message="Notifications generated successfully",
        data=NotificationGenerateData(**result),
    )


@router.post(
    "/read-all",
    response_model=NotificationMutateResponse,
    summary="Mark all notifications read",
)
def mark_all_read(
    current_user: CurrentUser,
    db: DbSession,
) -> NotificationMutateResponse:
    updated = notification_service.mark_all_read(db, current_user)
    return NotificationMutateResponse(
        success=True,
        message="All notifications marked as read",
        data={"updated": updated},
    )


@router.get(
    "/{notification_id}",
    response_model=NotificationApiResponse,
    summary="Get notification",
)
def get_notification(
    notification_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> NotificationApiResponse:
    row = notification_service.get_owned(db, current_user, notification_id)
    return NotificationApiResponse(
        success=True,
        message="Notification retrieved successfully",
        data=notification_service.to_response(row),
    )


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationApiResponse,
    summary="Mark notification read",
)
def mark_notification_read(
    notification_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> NotificationApiResponse:
    data = notification_service.mark_read(db, current_user, notification_id)
    return NotificationApiResponse(
        success=True, message="Notification marked as read", data=data
    )


@router.delete(
    "/{notification_id}",
    response_model=NotificationMutateResponse,
    summary="Delete notification",
)
def delete_notification(
    notification_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> NotificationMutateResponse:
    deleted_id = notification_service.delete_notification(
        db, current_user, notification_id
    )
    return NotificationMutateResponse(
        success=True,
        message="Notification deleted successfully",
        data={"id": deleted_id, "deleted": True},
    )
