"""Reusable streak utilities (foundation for Stage 7 analytics)."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Callable, Iterable, Optional

from app.utils.date_keys import is_future_key, to_date_key, today_key
from app.utils.habit_schedule import is_habit_scheduled_on_date


def completion_percentage(completed: int, scheduled: int) -> int:
    if scheduled <= 0:
        return 0
    return int(round((completed / scheduled) * 100))


def day_is_fully_completed(
    habits: Iterable,
    date_key: str,
    is_completed: Callable[[object, str], bool],
) -> bool:
    """True when every scheduled habit on date_key is completed.

    Days with zero scheduled habits are neither success nor failure
    (callers should skip them for streak continuity).
    """
    scheduled = [
        h for h in habits if is_habit_scheduled_on_date(h, date_key)
    ]
    if not scheduled:
        return False
    return all(is_completed(h, date_key) for h in scheduled)


def day_has_scheduled(habits: Iterable, date_key: str) -> bool:
    return any(is_habit_scheduled_on_date(h, date_key) for h in habits)


def get_current_streak(
    habits: Iterable,
    *,
    is_completed: Callable[[object, str], bool],
    as_of: Optional[str] = None,
) -> int:
    """Count consecutive fully-completed scheduled days ending at as_of.

    Unscheduled days are skipped (do not break the streak).
    Any incomplete scheduled day breaks the streak.
    Future as_of yields 0.
    """
    as_of_key = as_of or today_key()
    if is_future_key(as_of_key):
        return 0
    cursor = date.fromisoformat(as_of_key)
    streak = 0
    guard = 0
    while guard < 730:
        guard += 1
        key = to_date_key(cursor)
        if is_future_key(key, as_of_key):
            break
        if not day_has_scheduled(habits, key):
            cursor -= timedelta(days=1)
            continue
        if not day_is_fully_completed(habits, key, is_completed):
            break
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def get_longest_streak(
    habits: Iterable,
    *,
    is_completed: Callable[[object, str], bool],
    as_of: Optional[str] = None,
    lookback_days: int = 365,
) -> int:
    as_of_key = as_of or today_key()
    end = date.fromisoformat(as_of_key)
    longest = 0
    current = 0
    for offset in range(lookback_days - 1, -1, -1):
        key = to_date_key(end - timedelta(days=offset))
        if is_future_key(key, as_of_key):
            continue
        if not day_has_scheduled(habits, key):
            # Skip unscheduled days without breaking the run.
            continue
        if day_is_fully_completed(habits, key, is_completed):
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest
