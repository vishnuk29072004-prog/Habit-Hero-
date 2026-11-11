"""Achievement evaluation and listing (frontend ACHIEVEMENT_DEFS catalogue)."""

from __future__ import annotations

from datetime import timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.achievements.catalogue import ACHIEVEMENT_DEFS, get_achievement_def
from app.models.achievement import UserAchievement
from app.models.habit import Habit, HabitCheckin
from app.models.user import User
from app.schemas.achievement import (
    AchievementCatalogueItem,
    AchievementResponse,
    AchievementSummaryData,
)
from app.services import goal_service
from app.utils.date_keys import parse_date_key, to_date_key, today_key
from app.utils.streak_calculations import get_current_streak, get_longest_streak


def _to_response(row: UserAchievement) -> AchievementResponse:
    return AchievementResponse(
        id=row.id,
        achievement_id=row.achievement_id,
        title=row.title,
        body=row.body,
        icon=row.icon,
        unlocked_at=row.unlocked_at,
    )


def list_earned(db: Session, user: User) -> List[AchievementResponse]:
    rows = db.scalars(
        select(UserAchievement)
        .where(UserAchievement.user_id == user.id)
        .order_by(UserAchievement.unlocked_at.desc(), UserAchievement.id.desc())
    ).all()
    return [_to_response(r) for r in rows]


def get_earned(
    db: Session, user: User, achievement_id: str
) -> AchievementResponse:
    row = db.scalar(
        select(UserAchievement).where(
            UserAchievement.user_id == user.id,
            UserAchievement.achievement_id == achievement_id,
        )
    )
    if row is None:
        # Fall back to numeric PK lookup for API flexibility
        if achievement_id.isdigit():
            row = db.scalar(
                select(UserAchievement).where(
                    UserAchievement.user_id == user.id,
                    UserAchievement.id == int(achievement_id),
                )
            )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement not found",
        )
    return _to_response(row)


def get_summary(db: Session, user: User) -> AchievementSummaryData:
    earned = list_earned(db, user)
    earned_map = {e.achievement_id: e for e in earned}
    catalogue = []
    for defn in ACHIEVEMENT_DEFS:
        hit = earned_map.get(defn.id)
        catalogue.append(
            AchievementCatalogueItem(
                achievement_id=defn.id,
                title=defn.title,
                body=defn.body,
                icon=defn.icon,
                earned=hit is not None,
                unlocked_at=hit.unlocked_at if hit else None,
            )
        )
    return AchievementSummaryData(
        total_earned=len(earned),
        total_available=len(ACHIEVEMENT_DEFS),
        recent=earned[:5],
        catalogue=catalogue,
    )


def _build_context(db: Session, user: User, *, today: Optional[str] = None) -> dict:
    today = today or today_key()
    # Ensure goal completion flags are current before summary.
    goal_service.sync_user_goals(db, user, today=today)
    summary = goal_service.get_goals_summary(db, user)

    habits = list(
        db.scalars(
            select(Habit).where(Habit.user_id == user.id, Habit.archived == 0)
        ).all()
    )
    lookback = to_date_key(parse_date_key(today) - timedelta(days=400))
    checkin_rows = []
    if habits:
        checkin_rows = list(
            db.scalars(
                select(HabitCheckin).where(
                    HabitCheckin.habit_id.in_([h.id for h in habits]),
                    HabitCheckin.date >= lookback,
                    HabitCheckin.date <= today,
                )
            ).all()
        )
    checkins: Dict[Tuple[str, str], HabitCheckin] = {
        (r.habit_id, r.date): r for r in checkin_rows
    }

    def is_completed(habit: Habit, date_key: str) -> bool:
        row = checkins.get((habit.id, date_key))
        return row is not None and int(row.completed) == 1

    streak_days = get_current_streak(
        habits, is_completed=is_completed, as_of=today
    )
    longest = get_longest_streak(
        habits, is_completed=is_completed, as_of=today, lookback_days=365
    )

    return {
        "summary": {
            "total": summary.total,
            "active": summary.active,
            "completed": summary.completed,
            "not_started": summary.not_started,
            "overdue": summary.overdue,
            "completion_rate": summary.completion_rate,
        },
        "streak_days": streak_days,
        "longest_streak": longest,
    }


def evaluate_and_award(
    db: Session, user: User, *, today: Optional[str] = None
) -> List[AchievementResponse]:
    """Award newly earned achievements. Idempotent via unique constraint."""
    today = today or today_key()
    existing = {
        row.achievement_id
        for row in db.scalars(
            select(UserAchievement).where(UserAchievement.user_id == user.id)
        ).all()
    }
    ctx = _build_context(db, user, today=today)
    newly: List[AchievementResponse] = []

    for defn in ACHIEVEMENT_DEFS:
        if defn.id in existing:
            continue
        if not defn.test(ctx):
            continue
        row = UserAchievement(
            user_id=user.id,
            achievement_id=defn.id,
            title=defn.title,
            body=defn.body,
            icon=defn.icon,
            unlocked_at=today,
        )
        db.add(row)
        try:
            db.commit()
            db.refresh(row)
            newly.append(_to_response(row))
            existing.add(defn.id)
        except IntegrityError:
            db.rollback()
            # Another concurrent award — preserve original earned date.
            continue

    return newly
