"""Goals CRUD + progress enrichment."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.models.habit import Habit, HabitCheckin
from app.models.user import User
from app.schemas.goal import (
    GoalCreate,
    GoalListData,
    GoalProgress,
    GoalResponse,
    GoalSummaryData,
    GoalUpdate,
)
from app.services.goal_progress import (
    compute_goal_progress,
    compute_goal_status,
    should_mark_completed,
)
from app.utils.date_keys import today_key


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _load_habits(db: Session, user: User) -> List[Habit]:
    return list(db.scalars(select(Habit).where(Habit.user_id == user.id)).all())


def _load_checkins_for_habits(
    db: Session, habit_ids: List[str]
) -> Dict[Tuple[str, str], HabitCheckin]:
    if not habit_ids:
        return {}
    rows = db.scalars(
        select(HabitCheckin).where(HabitCheckin.habit_id.in_(habit_ids))
    ).all()
    return {(r.habit_id, r.date): r for r in rows}


def _validate_linked_habit(
    db: Session, user: User, linked_habit_id: Optional[str]
) -> Optional[Habit]:
    if not linked_habit_id:
        return None
    habit = db.scalar(
        select(Habit).where(
            Habit.id == linked_habit_id, Habit.user_id == user.id
        )
    )
    if habit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="linked_habit_id must refer to one of your habits",
        )
    return habit


def _habit_map(habits: List[Habit]) -> Dict[str, Habit]:
    return {h.id: h for h in habits}


def enrich_goal(
    goal: Goal,
    *,
    habits: List[Habit],
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: Optional[str] = None,
) -> GoalResponse:
    today = today or today_key()
    linked = (
        _habit_map(habits).get(goal.linked_habit_id)
        if goal.linked_habit_id
        else None
    )
    progress = compute_goal_progress(
        goal,
        linked_habit=linked,
        all_habits=habits,
        checkins=checkins,
        today=today,
    )
    status_value = compute_goal_status(goal, progress, today=today)
    return GoalResponse(
        id=goal.id,
        name=goal.name,
        description=goal.description,
        category=goal.category,
        icon=goal.icon,
        linked_habit_id=goal.linked_habit_id,
        target_type=goal.target_type,
        target_value=goal.target_value,
        start_date=goal.start_date,
        end_date=goal.end_date,
        created_at=goal.created_at,
        notes=goal.notes,
        archived=bool(goal.archived),
        completed_at=goal.completed_at,
        updated_at=goal.updated_at,
        status=status_value,  # type: ignore[arg-type]
        progress=progress,
    )


def sync_goal_completion_row(
    goal: Goal,
    *,
    habits: List[Habit],
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: Optional[str] = None,
) -> bool:
    """Update completed_at from progress. Returns True if row changed."""
    today = today or today_key()
    linked = (
        _habit_map(habits).get(goal.linked_habit_id)
        if goal.linked_habit_id
        else None
    )
    progress = compute_goal_progress(
        goal,
        linked_habit=linked,
        all_habits=habits,
        checkins=checkins,
        today=today,
    )
    changed = False
    if should_mark_completed(goal, progress, today=today):
        if not goal.completed_at:
            goal.completed_at = today
            goal.updated_at = _utcnow_iso()
            changed = True
    elif goal.completed_at and progress.rate < 100 and not progress.met:
        goal.completed_at = None
        goal.updated_at = _utcnow_iso()
        changed = True
    return changed


def sync_user_goals(db: Session, user: User, *, today: Optional[str] = None) -> int:
    today = today or today_key()
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id)).all())
    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    changed = 0
    for goal in goals:
        if sync_goal_completion_row(
            goal, habits=habits, checkins=checkins, today=today
        ):
            db.add(goal)
            changed += 1
    if changed:
        db.commit()
    return changed


def get_owned_goal(db: Session, user: User, goal_id: str) -> Goal:
    goal = db.scalar(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == user.id)
    )
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    return goal


def create_goal(db: Session, user: User, payload: GoalCreate) -> GoalResponse:
    _validate_linked_habit(db, user, payload.linked_habit_id)
    now = _utcnow_iso()
    today = today_key()
    goal = Goal(
        id=str(uuid.uuid4()),
        user_id=user.id,
        name=payload.name,
        description=payload.description or "",
        category=payload.category,
        icon=payload.icon or "",
        linked_habit_id=payload.linked_habit_id,
        target_type=payload.target_type,
        target_value=payload.target_value,
        start_date=payload.start_date,
        end_date=payload.end_date,
        created_at=today,
        notes=payload.notes or "",
        archived=0,
        completed_at=None,
        updated_at=now,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)

    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    if sync_goal_completion_row(goal, habits=habits, checkins=checkins):
        db.add(goal)
        db.commit()
        db.refresh(goal)

    # Achievement evaluation after create (may unlock nothing yet)
    from app.services import achievement_service

    achievement_service.evaluate_and_award(db, user)

    return enrich_goal(goal, habits=habits, checkins=checkins)


def list_goals(
    db: Session,
    user: User,
    *,
    status_filter: Optional[str] = None,
    category: Optional[str] = None,
    archived: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> GoalListData:
    sync_user_goals(db, user)
    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    rows = list(
        db.scalars(
            select(Goal)
            .where(Goal.user_id == user.id)
            .order_by(Goal.created_at.desc(), Goal.name.asc())
        ).all()
    )

    enriched = [
        enrich_goal(g, habits=habits, checkins=checkins) for g in rows
    ]
    if archived is True:
        enriched = [g for g in enriched if g.archived]
    elif archived is False:
        enriched = [g for g in enriched if not g.archived]
    if category:
        enriched = [g for g in enriched if g.category == category]
    if status_filter:
        enriched = [g for g in enriched if g.status == status_filter]

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    total = len(enriched)
    start = (page - 1) * page_size
    items = enriched[start : start + page_size]
    return GoalListData(
        items=items, total=total, page=page, page_size=page_size
    )


def get_goal(db: Session, user: User, goal_id: str) -> GoalResponse:
    sync_user_goals(db, user)
    goal = get_owned_goal(db, user, goal_id)
    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    return enrich_goal(goal, habits=habits, checkins=checkins)


def update_goal(
    db: Session, user: User, goal_id: str, payload: GoalUpdate
) -> GoalResponse:
    goal = get_owned_goal(db, user, goal_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No goal fields provided",
        )

    clear_link = data.pop("clear_linked_habit", False)
    if clear_link:
        goal.linked_habit_id = None
    elif "linked_habit_id" in data:
        _validate_linked_habit(db, user, data["linked_habit_id"])
        goal.linked_habit_id = data["linked_habit_id"]

    for field in (
        "name",
        "description",
        "category",
        "icon",
        "target_type",
        "target_value",
        "start_date",
        "end_date",
        "notes",
    ):
        if field in data:
            setattr(goal, field, data[field])

    if "archived" in data:
        goal.archived = 1 if data["archived"] else 0

    if goal.end_date < goal.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not precede start_date",
        )
    if (
        goal.target_type == "completion_percentage"
        and goal.target_value > 100
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="completion_percentage target_value must be 1–100",
        )

    goal.updated_at = _utcnow_iso()
    db.add(goal)
    db.commit()
    db.refresh(goal)

    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    if sync_goal_completion_row(goal, habits=habits, checkins=checkins):
        db.add(goal)
        db.commit()
        db.refresh(goal)

    from app.services import achievement_service

    achievement_service.evaluate_and_award(db, user)
    return enrich_goal(goal, habits=habits, checkins=checkins)


def delete_goal(db: Session, user: User, goal_id: str) -> str:
    goal = get_owned_goal(db, user, goal_id)
    deleted_id = goal.id
    db.delete(goal)
    db.commit()
    return deleted_id


def get_goals_summary(db: Session, user: User) -> GoalSummaryData:
    sync_user_goals(db, user)
    habits = _load_habits(db, user)
    checkins = _load_checkins_for_habits(db, [h.id for h in habits])
    rows = list(
        db.scalars(
            select(Goal)
            .where(Goal.user_id == user.id, Goal.archived == 0)
            .order_by(Goal.created_at.desc())
        ).all()
    )
    goals = [enrich_goal(g, habits=habits, checkins=checkins) for g in rows]

    active = completed = not_started = overdue = 0
    for g in goals:
        if g.status == "completed":
            completed += 1
        elif g.status == "overdue":
            overdue += 1
        elif g.status == "not_started":
            not_started += 1
        elif g.status == "in_progress":
            active += 1

    total = len(goals)
    return GoalSummaryData(
        total=total,
        active=active,
        completed=completed,
        not_started=not_started,
        overdue=overdue,
        completion_rate=round((completed / total) * 100) if total else 0,
        goals=goals,
    )
