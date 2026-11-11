"""Idempotent in-app notification generation (date-key based, no push/email)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.models.habit import Habit, HabitCheckin
from app.models.notification import Notification
from app.models.user import User, UserSettings
from app.services import user_service
from app.services.goal_progress import compute_goal_progress, compute_goal_status
from app.utils.date_keys import iter_date_keys, parse_date_key, today_key, to_date_key
from app.utils.habit_schedule import is_habit_scheduled_on_date
from app.utils.streak_calculations import get_current_streak

# Lookback for overdue habit reminders (stable per missed date via dedupe_key).
OVERDUE_LOOKBACK_DAYS = 7
GOAL_DEADLINE_WINDOW_DAYS = 3
STREAK_APPROACH_WINDOW = 2


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _iso_week_key(day: str) -> str:
    d = parse_date_key(day)
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _pref_on(settings: UserSettings, name: str) -> bool:
    return bool(getattr(settings, name, 0))


def _upsert(
    db: Session,
    *,
    user_id: str,
    type_: str,
    title: str,
    message: str,
    dedupe_key: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
) -> bool:
    """Insert notification if dedupe_key is new. Returns True when created."""
    existing = db.scalar(
        select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.dedupe_key == dedupe_key,
        )
    )
    if existing is not None:
        return False

    row = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
        dedupe_key=dedupe_key,
        created_at=_utcnow_iso(),
        read_at=None,
    )
    db.add(row)
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def _load_habits(db: Session, user: User) -> List[Habit]:
    return list(
        db.scalars(
            select(Habit).where(Habit.user_id == user.id, Habit.archived == 0)
        ).all()
    )


def _load_checkins(
    db: Session, habit_ids: List[str], start: str, end: str
) -> Dict[Tuple[str, str], HabitCheckin]:
    if not habit_ids:
        return {}
    rows = db.scalars(
        select(HabitCheckin).where(
            HabitCheckin.habit_id.in_(habit_ids),
            HabitCheckin.date >= start,
            HabitCheckin.date <= end,
        )
    ).all()
    return {(r.habit_id, r.date): r for r in rows}


def _is_completed(
    checkins: Dict[Tuple[str, str], HabitCheckin], habit_id: str, date_key: str
) -> bool:
    row = checkins.get((habit_id, date_key))
    return row is not None and int(row.completed) == 1


def generate_for_user(
    db: Session,
    user: User,
    *,
    today: Optional[str] = None,
) -> dict:
    """Evaluate habits/goals and upsert notifications. Idempotent via dedupe_key."""
    today = today or today_key()
    settings = user_service.get_or_create_settings(db, user)
    created = skipped = 0

    def record(ok: bool) -> None:
        nonlocal created, skipped
        if ok:
            created += 1
        else:
            skipped += 1

    if not _pref_on(settings, "notifications_enabled"):
        return {"created": 0, "skipped": 0}

    habits = _load_habits(db, user)
    habit_ids = [h.id for h in habits]
    lookback_start = to_date_key(
        parse_date_key(today) - timedelta(days=OVERDUE_LOOKBACK_DAYS)
    )
    tomorrow = to_date_key(parse_date_key(today) + timedelta(days=1))
    end_window = tomorrow
    checkins = _load_checkins(db, habit_ids, lookback_start, end_window)

    # --- Habit reminders ---
    for habit in habits:
        scheduled_today = is_habit_scheduled_on_date(habit, today)
        completed_today = _is_completed(checkins, habit.id, today)

        if scheduled_today and not completed_today:
            if (habit.frequency or "Daily") == "Weekly":
                if _pref_on(settings, "remind_habits_weekly"):
                    record(
                        _upsert(
                            db,
                            user_id=user.id,
                            type_="habit_weekly_reminder",
                            title="Weekly habit reminder",
                            message=f"{habit.name} is scheduled today and still pending.",
                            dedupe_key=f"habit_weekly:{habit.id}:{today}",
                            resource_type="habit",
                            resource_id=habit.id,
                        )
                    )
            elif _pref_on(settings, "remind_habits_daily"):
                record(
                    _upsert(
                        db,
                        user_id=user.id,
                        type_="habit_daily_reminder",
                        title="Habit reminder",
                        message=f"{habit.name} is still pending for today.",
                        dedupe_key=f"habit_daily:{habit.id}:{today}",
                        resource_type="habit",
                        resource_id=habit.id,
                    )
                )

        if _pref_on(settings, "remind_habits_upcoming"):
            if is_habit_scheduled_on_date(habit, tomorrow) and not _is_completed(
                checkins, habit.id, tomorrow
            ):
                record(
                    _upsert(
                        db,
                        user_id=user.id,
                        type_="habit_upcoming",
                        title="Upcoming habit",
                        message=f"{habit.name} is scheduled for tomorrow.",
                        dedupe_key=f"habit_upcoming:{habit.id}:{tomorrow}",
                        resource_type="habit",
                        resource_id=habit.id,
                    )
                )

        if _pref_on(settings, "remind_habits_overdue"):
            # Past dates only (today is pending, not overdue). One notif per missed date.
            for key in iter_date_keys(lookback_start, today):
                if key >= today:
                    continue
                if not is_habit_scheduled_on_date(habit, key):
                    continue
                if _is_completed(checkins, habit.id, key):
                    continue
                record(
                    _upsert(
                        db,
                        user_id=user.id,
                        type_="habit_overdue",
                        title="Overdue habit",
                        message=f"{habit.name} was missed on {key}.",
                        dedupe_key=f"habit_overdue:{habit.id}:{key}",
                        resource_type="habit",
                        resource_id=habit.id,
                    )
                )

    # --- Goals ---
    if _pref_on(settings, "remind_goal_deadlines"):
        goals = list(
            db.scalars(
                select(Goal).where(Goal.user_id == user.id, Goal.archived == 0)
            ).all()
        )
        all_habits = list(
            db.scalars(select(Habit).where(Habit.user_id == user.id)).all()
        )
        all_ids = [h.id for h in all_habits]
        goal_checkins = _load_checkins(
            db,
            all_ids,
            min((g.start_date for g in goals), default=today),
            today,
        ) if goals else {}
        habit_map = {h.id: h for h in all_habits}
        today_d = parse_date_key(today)

        for goal in goals:
            linked = (
                habit_map.get(goal.linked_habit_id) if goal.linked_habit_id else None
            )
            progress = compute_goal_progress(
                goal,
                linked_habit=linked,
                all_habits=all_habits,
                checkins=goal_checkins,
                today=today,
            )
            status_value = compute_goal_status(goal, progress, today=today)
            if status_value == "completed":
                continue
            if status_value == "overdue":
                record(
                    _upsert(
                        db,
                        user_id=user.id,
                        type_="goal_overdue",
                        title="Goal overdue",
                        message=f"{goal.name} is past its deadline ({goal.end_date}).",
                        dedupe_key=f"goal_overdue:{goal.id}:{goal.end_date}",
                        resource_type="goal",
                        resource_id=goal.id,
                    )
                )
                continue

            end_d = parse_date_key(goal.end_date)
            days_left = (end_d - today_d).days
            if 0 <= days_left <= GOAL_DEADLINE_WINDOW_DAYS:
                record(
                    _upsert(
                        db,
                        user_id=user.id,
                        type_="goal_deadline",
                        title="Goal deadline approaching",
                        message=(
                            f"{goal.name} ends on {goal.end_date} "
                            f"({days_left} day{'s' if days_left != 1 else ''} left)."
                        ),
                        dedupe_key=f"goal_deadline:{goal.id}:{goal.end_date}",
                        resource_type="goal",
                        resource_id=goal.id,
                    )
                )

    # --- Streak milestone ---
    if _pref_on(settings, "remind_streak_milestones") and habits:

        def is_completed(habit: Habit, date_key: str) -> bool:
            return _is_completed(checkins, habit.id, date_key)

        # Expand checkin window for streak lookback
        streak_start = to_date_key(parse_date_key(today) - timedelta(days=400))
        streak_checkins = _load_checkins(db, habit_ids, streak_start, today)

        def is_completed_streak(habit: Habit, date_key: str) -> bool:
            return _is_completed(streak_checkins, habit.id, date_key)

        streak = get_current_streak(
            habits, is_completed=is_completed_streak, as_of=today
        )
        target = int(settings.streak_goal_target or 15)
        remaining = target - streak
        if streak > 0 and 0 <= remaining <= STREAK_APPROACH_WINDOW:
            record(
                _upsert(
                    db,
                    user_id=user.id,
                    type_="streak_milestone",
                    title="Streak milestone",
                    message=(
                        f"You are on a {streak}-day streak. "
                        f"{'Goal reached!' if remaining == 0 else f'{remaining} day(s) to your {target}-day goal.'}"
                    ),
                    dedupe_key=f"streak_milestone:{target}:{today}",
                    resource_type="streak",
                    resource_id=None,
                )
            )

    # --- Weekly summary (one per ISO week) ---
    if _pref_on(settings, "remind_weekly_summary"):
        week_key = _iso_week_key(today)
        # Only emit once the week has started (Monday+); message is a nudge.
        record(
            _upsert(
                db,
                user_id=user.id,
                type_="weekly_summary",
                title="Weekly summary",
                message="Review your consistency insights this week.",
                dedupe_key=f"weekly_summary:{week_key}",
                resource_type="system",
                resource_id=None,
            )
        )

    return {"created": created, "skipped": skipped}


def generate_for_all_users(db: Session, *, today: Optional[str] = None) -> dict:
    today = today or today_key()
    users = list(db.scalars(select(User)).all())
    total_created = total_skipped = 0
    for user in users:
        result = generate_for_user(db, user, today=today)
        total_created += result["created"]
        total_skipped += result["skipped"]
    return {
        "users": len(users),
        "created": total_created,
        "skipped": total_skipped,
    }
