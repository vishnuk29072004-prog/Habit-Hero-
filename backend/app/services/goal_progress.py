"""Goal progress/status calculation (mirrors frontend goalCalculations.js)."""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Tuple

from app.models.habit import Habit, HabitCheckin
from app.models.goal import Goal
from app.schemas.goal import GoalProgress
from app.utils.date_keys import is_future_key, iter_date_keys, today_key
from app.utils.habit_schedule import is_habit_scheduled_on_date


def _clamp_window(goal: Goal, today: str) -> tuple[str, str, bool]:
    start = goal.start_date
    end = goal.end_date
    if end > today:
        end = today
    if start > end:
        return start, start, True
    return start, end, False


def _is_done(
    habit: Habit,
    date_key: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
) -> bool:
    row = checkins.get((habit.id, date_key))
    return row is not None and int(row.completed) == 1


def _count_completions(
    habit: Optional[Habit],
    start: str,
    end: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> tuple[int, int]:
    if habit is None:
        return 0, 0
    current = scheduled = 0
    for key in iter_date_keys(start, end):
        if is_future_key(key, today):
            continue
        if not is_habit_scheduled_on_date(habit, key):
            continue
        scheduled += 1
        if _is_done(habit, key, checkins):
            current += 1
    return current, scheduled


def _best_consecutive(
    habit: Optional[Habit],
    start: str,
    end: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> int:
    if habit is None:
        return 0
    best = run = 0
    for key in iter_date_keys(start, end):
        if is_future_key(key, today):
            continue
        if not is_habit_scheduled_on_date(habit, key):
            continue
        if _is_done(habit, key, checkins):
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def _current_consecutive(
    habit: Optional[Habit],
    start: str,
    end: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> int:
    if habit is None:
        return 0
    keys = [
        key
        for key in iter_date_keys(start, end)
        if not is_future_key(key, today)
        and is_habit_scheduled_on_date(habit, key)
    ]
    run = 0
    for key in reversed(keys):
        if _is_done(habit, key, checkins):
            run += 1
        else:
            break
    return run


def _unit_for_type(target_type: str) -> str:
    if target_type == "completion_percentage":
        return "%"
    if target_type == "completion_count":
        return "times"
    return "days"


def compute_goal_progress(
    goal: Goal,
    *,
    linked_habit: Optional[Habit],
    all_habits: Iterable[Habit],
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: Optional[str] = None,
) -> GoalProgress:
    today = today or today_key()
    target = max(1, int(goal.target_value))
    start, end, empty = _clamp_window(goal, today)
    unit = _unit_for_type(goal.target_type)

    if empty:
        return GoalProgress(
            current=0,
            target=target,
            rate=0,
            unit=unit,
            label=f"0 / {target} {unit}",
        )

    target_type = goal.target_type or "completion_count"

    if target_type == "completion_count":
        current, _ = _count_completions(linked_habit, start, end, checkins, today)
        capped = min(current, target)
        return GoalProgress(
            current=capped,
            target=target,
            rate=min(100, round((capped / target) * 100)),
            unit="times",
            label=f"{capped} / {target} times",
        )

    if target_type == "consecutive_days":
        best = _best_consecutive(linked_habit, start, end, checkins, today)
        current = min(best, target)
        return GoalProgress(
            current=current,
            target=target,
            rate=min(100, round((current / target) * 100)),
            unit="days",
            label=f"{current} / {target} days",
            current_streak=_current_consecutive(
                linked_habit, start, end, checkins, today
            ),
        )

    if target_type == "days_completed":
        current, _ = _count_completions(linked_habit, start, end, checkins, today)
        capped = min(current, target)
        return GoalProgress(
            current=capped,
            target=target,
            rate=min(100, round((capped / target) * 100)),
            unit="days",
            label=f"{capped} / {target} days",
        )

    # completion_percentage
    if linked_habit is not None and int(linked_habit.archived) == 0:
        done, scheduled = _count_completions(
            linked_habit, start, end, checkins, today
        )
        rate = round((done / scheduled) * 100) if scheduled else 0
    else:
        scheduled = completed = 0
        for habit in all_habits:
            if int(habit.archived) == 1:
                continue
            c, s = _count_completions(habit, start, end, checkins, today)
            completed += c
            scheduled += s
        rate = round((completed / scheduled) * 100) if scheduled else 0

    met = rate >= target
    return GoalProgress(
        current=rate,
        target=target,
        rate=min(100, round((min(rate, target) / target) * 100)),
        unit="%",
        label=f"{rate}% / {target}%",
        met=met,
        actual_rate=rate,
    )


def compute_goal_status(
    goal: Goal, progress: GoalProgress, *, today: Optional[str] = None
) -> str:
    today = today or today_key()
    if int(goal.archived) == 1:
        return "archived"

    is_complete = bool(goal.completed_at) or progress.rate >= 100 or (
        goal.target_type == "completion_percentage"
        and bool(progress.met)
        and today >= goal.end_date
    )
    if is_complete:
        return "completed"
    if today > goal.end_date:
        return "overdue"
    if progress.current == 0:
        return "not_started"
    return "in_progress"


def should_mark_completed(
    goal: Goal, progress: GoalProgress, *, today: Optional[str] = None
) -> bool:
    today = today or today_key()
    return progress.rate >= 100 or (
        goal.target_type == "completion_percentage"
        and bool(progress.met)
        and today >= goal.end_date
    )
