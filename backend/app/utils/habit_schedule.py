"""Centralized habit scheduling (Daily / Weekly)."""

from __future__ import annotations

from datetime import date
from typing import Optional, Protocol

from app.utils.date_keys import parse_date_key, weekday_sun0


class HabitLike(Protocol):
    frequency: str
    start_date: str
    week_day: Optional[int]
    archived: int


def is_habit_scheduled_on_date(
    habit: HabitLike,
    date_key: str,
    *,
    include_archived: bool = False,
) -> bool:
    """Return True when the habit is scheduled on date_key.

    - Respects start_date (date_key >= start_date).
    - Daily: every day from start.
    - Weekly: only matching week_day (Sun=0 … Sat=6).
    - Archived habits are excluded unless include_archived=True
      (historical reads may pass include_archived when needed).
    """
    if not include_archived and int(habit.archived or 0) == 1:
        return False

    start_key = habit.start_date
    if date_key < start_key:
        return False

    frequency = habit.frequency or "Daily"
    if frequency == "Daily":
        return True

    if frequency == "Weekly":
        week_day = habit.week_day
        if week_day is None:
            week_day = weekday_sun0(parse_date_key(start_key))
        return weekday_sun0(parse_date_key(date_key)) == int(week_day)

    return False


def is_eligible_for_checkin(habit: HabitLike, date_key: str) -> tuple[bool, str]:
    """Validate whether a new/updated check-in is allowed for the date."""
    if int(habit.archived or 0) == 1:
        return False, "Cannot check in an archived habit"
    if date_key < habit.start_date:
        return False, "Cannot check in before the habit start date"
    if not is_habit_scheduled_on_date(habit, date_key, include_archived=False):
        if (habit.frequency or "Daily") == "Weekly":
            return False, "Habit is not scheduled on this weekday"
        return False, "Habit is not scheduled on this date"
    return True, ""
