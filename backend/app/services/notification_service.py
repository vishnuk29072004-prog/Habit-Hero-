"""Notification inbox CRUD (user-scoped)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationListData,
    NotificationResponse,
    NotificationSummaryData,
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def to_response(row: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=row.id,
        type=row.type,
        title=row.title,
        message=row.message,
        resource_type=row.resource_type,
        resource_id=row.resource_id,
        unread=row.read_at is None,
        created_at=row.created_at,
        read_at=row.read_at,
    )


def get_owned(db: Session, user: User, notification_id: str) -> Notification:
    row = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return row


def unread_count(db: Session, user: User) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
        )
        or 0
    )


def list_notifications(
    db: Session,
    user: User,
    *,
    unread_only: bool = False,
    type_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> NotificationListData:
    filters = [Notification.user_id == user.id]
    if unread_only:
        filters.append(Notification.read_at.is_(None))
    if type_filter:
        filters.append(Notification.type == type_filter)

    total = (
        db.scalar(
            select(func.count()).select_from(Notification).where(*filters)
        )
        or 0
    )
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows = db.scalars(
        select(Notification)
        .where(*filters)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return NotificationListData(
        items=[to_response(r) for r in rows],
        total=total,
        unread=unread_count(db, user),
        page=page,
        page_size=page_size,
    )


def get_summary(db: Session, user: User) -> NotificationSummaryData:
    total = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id)
        )
        or 0
    )
    return NotificationSummaryData(total=total, unread=unread_count(db, user))


def mark_read(db: Session, user: User, notification_id: str) -> NotificationResponse:
    row = get_owned(db, user, notification_id)
    if row.read_at is None:
        row.read_at = _utcnow_iso()
        db.add(row)
        db.commit()
        db.refresh(row)
    return to_response(row)


def mark_all_read(db: Session, user: User) -> int:
    now = _utcnow_iso()
    result = db.execute(
        update(Notification)
        .where(
            Notification.user_id == user.id,
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    db.commit()
    return int(result.rowcount or 0)


def delete_notification(db: Session, user: User, notification_id: str) -> str:
    row = get_owned(db, user, notification_id)
    deleted_id = row.id
    db.delete(row)
    db.commit()
    return deleted_id
