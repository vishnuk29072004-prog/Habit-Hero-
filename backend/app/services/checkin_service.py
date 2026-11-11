"""Habit check-in CRUD (scoped via owning habit)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitCheckin
from app.models.user import User
from app.schemas.checkin import (
    CheckinCreate,
    CheckinListData,
    CheckinResponse,
    CheckinUpdate,
)
from app.services import habit_service
from app.utils.habit_schedule import is_eligible_for_checkin


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _post_checkin_side_effects(db: Session, user: User) -> None:
    """Sync goal completion and evaluate achievements after check-in changes."""
    from app.services import achievement_service, goal_service

    goal_service.sync_user_goals(db, user)
    achievement_service.evaluate_and_award(db, user)


def status_from_completed(completed: int) -> str:
    return "completed" if int(completed) == 1 else "incomplete"


def completed_from_status(status_value: str) -> int:
    return 1 if status_value == "completed" else 0


def to_checkin_response(row: HabitCheckin) -> CheckinResponse:
    return CheckinResponse(
        id=row.id,
        habit_id=row.habit_id,
        date=row.date,
        status=status_from_completed(row.completed),  # type: ignore[arg-type]
        notes=row.notes,
        updated_at=row.updated_at,
    )


def create_checkin(
    db: Session, user: User, habit_id: str, payload: CheckinCreate
) -> HabitCheckin:
    habit = habit_service.get_owned_habit(db, user, habit_id)
    ok, reason = is_eligible_for_checkin(habit, payload.date)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    existing = db.scalar(
        select(HabitCheckin).where(
            HabitCheckin.habit_id == habit.id,
            HabitCheckin.date == payload.date,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A check-in already exists for this habit and date",
        )

    row = HabitCheckin(
        habit_id=habit.id,
        date=payload.date,
        completed=completed_from_status(payload.status),
        notes=payload.notes or "",
        updated_at=_utcnow_iso(),
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A check-in already exists for this habit and date",
        ) from exc
    db.refresh(row)
    _post_checkin_side_effects(db, user)
    return row


def list_checkins(
    db: Session,
    user: User,
    habit_id: str,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> CheckinListData:
    habit = habit_service.get_owned_habit(db, user, habit_id)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    filters = [HabitCheckin.habit_id == habit.id]
    if start_date:
        filters.append(HabitCheckin.date >= start_date)
    if end_date:
        filters.append(HabitCheckin.date <= end_date)
    if status_filter == "completed":
        filters.append(HabitCheckin.completed == 1)
    elif status_filter == "incomplete":
        filters.append(HabitCheckin.completed == 0)
    elif status_filter is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be completed or incomplete",
        )

    total = db.scalar(
        select(func.count()).select_from(HabitCheckin).where(*filters)
    ) or 0
    rows = db.scalars(
        select(HabitCheckin)
        .where(*filters)
        .order_by(HabitCheckin.date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return CheckinListData(
        items=[to_checkin_response(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_checkin_by_date(
    db: Session, user: User, habit_id: str, date_key: str
) -> HabitCheckin:
    habit = habit_service.get_owned_habit(db, user, habit_id)
    row = db.scalar(
        select(HabitCheckin).where(
            HabitCheckin.habit_id == habit.id,
            HabitCheckin.date == date_key,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found for this date",
        )
    return row


def get_owned_checkin(
    db: Session, user: User, habit_id: str, checkin_id: int
) -> HabitCheckin:
    habit = habit_service.get_owned_habit(db, user, habit_id)
    row = db.scalar(
        select(HabitCheckin).where(
            HabitCheckin.id == checkin_id,
            HabitCheckin.habit_id == habit.id,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Check-in not found",
        )
    return row


def update_checkin(
    db: Session,
    user: User,
    habit_id: str,
    checkin_id: int,
    payload: CheckinUpdate,
) -> HabitCheckin:
    row = get_owned_checkin(db, user, habit_id, checkin_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No check-in fields provided",
        )
    if "status" in data:
        row.completed = completed_from_status(data["status"])
    if "notes" in data:
        row.notes = data["notes"]
    row.updated_at = _utcnow_iso()
    db.add(row)
    db.commit()
    db.refresh(row)
    _post_checkin_side_effects(db, user)
    return row


def delete_checkin(
    db: Session, user: User, habit_id: str, checkin_id: int
) -> int:
    row = get_owned_checkin(db, user, habit_id, checkin_id)
    deleted_id = row.id
    db.delete(row)
    db.commit()
    return deleted_id
