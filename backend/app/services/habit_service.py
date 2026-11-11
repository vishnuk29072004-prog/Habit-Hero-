"""Habit CRUD, archive/restore, search, and filtering."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.models.habit import Habit, HabitCheckin
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.habit import (
    HabitCreate,
    HabitListData,
    HabitResponse,
    HabitUpdate,
    StatusFilter,
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _today_key() -> str:
    return date.today().isoformat()


def to_habit_response(habit: Habit) -> HabitResponse:
    is_archived = bool(habit.archived)
    return HabitResponse(
        id=habit.id,
        name=habit.name,
        description=habit.description,
        notes=habit.notes,
        icon=habit.icon,
        category=habit.category,
        frequency=habit.frequency,
        start_date=habit.start_date,
        week_day=habit.week_day,
        is_archived=is_archived,
        is_active=not is_archived,
        created_at=habit.created_at,
        updated_at=habit.updated_at,
    )


def get_owned_habit(db: Session, user: User, habit_id: str) -> Habit:
    habit = db.scalar(
        select(Habit).where(Habit.id == habit_id, Habit.user_id == user.id)
    )
    if habit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Habit not found",
        )
    return habit


def _resolve_week_day(
    *,
    frequency: str,
    week_day: Optional[int],
    start_date: str,
) -> Optional[int]:
    if frequency == "Weekly":
        if week_day is not None:
            return week_day
        parsed = date.fromisoformat(start_date)
        # date-fns getDay: Sun=0 .. Sat=6
        return (parsed.weekday() + 1) % 7
    return None


def create_habit(db: Session, user: User, payload: HabitCreate) -> Habit:
    now = _utcnow_iso()
    habit = Habit(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=payload.name,
        description=payload.description or "",
        notes=payload.notes or "",
        icon=payload.icon or "sparkles",
        category=payload.category,
        frequency=payload.frequency,
        start_date=payload.start_date,
        created_at=_today_key(),
        archived=0,
        week_day=_resolve_week_day(
            frequency=payload.frequency,
            week_day=payload.week_day,
            start_date=payload.start_date,
        ),
        updated_at=now,
    )
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def list_habits(
    db: Session,
    user: User,
    *,
    status_filter: StatusFilter = "all",
    category: Optional[str] = None,
    frequency: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> HabitListData:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    filters = [Habit.user_id == user.id]

    if status_filter == "active":
        filters.append(Habit.archived == 0)
    elif status_filter == "archived":
        filters.append(Habit.archived == 1)

    if category:
        if category == "Lifestyle":
            category = "Mental Health"
        filters.append(Habit.category == category)

    if frequency:
        # Accept Daily/Weekly; normalize common lowercase variants.
        normalized = frequency.strip().capitalize()
        if normalized == "Daily":
            filters.append(Habit.frequency == "Daily")
        elif normalized == "Weekly":
            filters.append(Habit.frequency == "Weekly")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="frequency must be Daily or Weekly",
            )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        filters.append(func.lower(Habit.name).like(term))

    total = db.scalar(
        select(func.count()).select_from(Habit).where(*filters)
    ) or 0

    rows = db.scalars(
        select(Habit)
        .where(*filters)
        .order_by(Habit.created_at.desc(), Habit.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return HabitListData(
        items=[to_habit_response(h) for h in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_habit_by_id(db: Session, user: User, habit_id: str) -> Habit:
    return get_owned_habit(db, user, habit_id)


def update_habit(
    db: Session, user: User, habit_id: str, payload: HabitUpdate
) -> Habit:
    habit = get_owned_habit(db, user, habit_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No habit fields provided",
        )

    frequency = data.get("frequency", habit.frequency)
    start_date = data.get("start_date", habit.start_date)
    week_day = data["week_day"] if "week_day" in data else habit.week_day

    if frequency not in ("Daily", "Weekly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="frequency must be Daily or Weekly",
        )

    for field in ("name", "description", "notes", "icon", "category", "start_date"):
        if field in data:
            setattr(habit, field, data[field])

    habit.frequency = frequency
    habit.week_day = _resolve_week_day(
        frequency=frequency,
        week_day=week_day if frequency == "Weekly" else None,
        start_date=start_date,
    )
    habit.updated_at = _utcnow_iso()
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def _habit_has_history(db: Session, habit_id: str) -> bool:
    has_checkin = db.scalar(
        select(func.count())
        .select_from(HabitCheckin)
        .where(HabitCheckin.habit_id == habit_id)
    )
    if has_checkin:
        return True
    has_goal = db.scalar(
        select(func.count()).select_from(Goal).where(Goal.linked_habit_id == habit_id)
    )
    if has_goal:
        return True
    has_journal = db.scalar(
        select(func.count())
        .select_from(JournalEntry)
        .where(JournalEntry.habit_id == habit_id)
    )
    return bool(has_journal)


def delete_habit(db: Session, user: User, habit_id: str) -> tuple[Habit | None, str]:
    """Hard-delete when no history; otherwise archive to preserve records.

    Returns (habit_or_none, action) where action is 'deleted' or 'archived'.
    """
    habit = get_owned_habit(db, user, habit_id)
    if _habit_has_history(db, habit.id):
        if habit.archived != 1:
            habit.archived = 1
            habit.updated_at = _utcnow_iso()
            db.add(habit)
            db.commit()
            db.refresh(habit)
        return habit, "archived"

    db.delete(habit)
    db.commit()
    return None, "deleted"


def archive_habit(db: Session, user: User, habit_id: str) -> Habit:
    habit = get_owned_habit(db, user, habit_id)
    if habit.archived == 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Habit is already archived",
        )
    habit.archived = 1
    habit.updated_at = _utcnow_iso()
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


def restore_habit(db: Session, user: User, habit_id: str) -> Habit:
    habit = get_owned_habit(db, user, habit_id)
    if habit.archived == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Habit is not archived",
        )
    habit.archived = 0
    habit.updated_at = _utcnow_iso()
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit
