"""Calendar summaries derived from habits + check-ins + notes + journal."""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.day_note import DayNote
from app.models.habit import Habit, HabitCheckin
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.calendar import (
    CalendarDayHabit,
    CalendarDaySummary,
    CalendarSummaryData,
    CalendarTrendPoint,
    DailyCalendarData,
    MonthlyCalendarData,
)
from app.utils.date_keys import (
    is_future_key,
    is_past_key,
    iter_date_keys,
    month_date_keys,
    parse_date_key,
    today_key,
    weekday_sun0,
)
from app.utils.habit_schedule import is_habit_scheduled_on_date
from app.utils.streak_calculations import completion_percentage


WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def get_completion_percentage(completed: int, scheduled: int) -> int:
    return completion_percentage(completed, scheduled)


def _load_active_habits(db: Session, user: User) -> List[Habit]:
    return list(
        db.scalars(
            select(Habit).where(Habit.user_id == user.id, Habit.archived == 0)
        ).all()
    )


def _load_checkin_map(
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


def _journal_dates(db: Session, user: User, start: str, end: str) -> set[str]:
    rows = db.scalars(
        select(JournalEntry.date).where(
            JournalEntry.user_id == user.id,
            JournalEntry.date >= start,
            JournalEntry.date <= end,
        )
    ).all()
    return set(rows)


def _note_dates(db: Session, user: User, start: str, end: str) -> set[str]:
    rows = db.scalars(
        select(DayNote.date).where(
            DayNote.user_id == user.id,
            DayNote.date >= start,
            DayNote.date <= end,
        )
    ).all()
    return set(rows)


def get_habit_status_for_date(
    habit: Habit,
    date_key: str,
    checkin: Optional[HabitCheckin],
    *,
    today: Optional[str] = None,
) -> str:
    today = today or today_key()
    scheduled = is_habit_scheduled_on_date(habit, date_key)
    if not scheduled:
        return "not_scheduled"
    if checkin is not None and int(checkin.completed) == 1:
        return "completed"
    if is_future_key(date_key, today):
        return "pending"
    if date_key == today:
        return "pending"
    return "missed"


def _summarize_day(
    habits: Iterable[Habit],
    date_key: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    *,
    today: str,
    has_journal: bool = False,
    has_notes: bool = False,
) -> CalendarDaySummary:
    completed = pending = missed = 0
    total = 0
    for habit in habits:
        if not is_habit_scheduled_on_date(habit, date_key):
            continue
        total += 1
        status_value = get_habit_status_for_date(
            habit,
            date_key,
            checkins.get((habit.id, date_key)),
            today=today,
        )
        if status_value == "completed":
            completed += 1
        elif status_value == "pending":
            pending += 1
        elif status_value == "missed":
            missed += 1

    return CalendarDaySummary(
        date=date_key,
        total_habits=total,
        completed=completed,
        pending=pending,
        missed=missed,
        completion_percentage=get_completion_percentage(completed, total),
        has_journal=has_journal,
        has_notes=has_notes,
    )


def get_daily_summary(
    db: Session, user: User, date_key: str, *, today: Optional[str] = None
) -> DailyCalendarData:
    today = today or today_key()
    try:
        parse_date_key(date_key)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Date must be YYYY-MM-DD",
        ) from exc

    habits = _load_active_habits(db, user)
    checkins = _load_checkin_map(db, [h.id for h in habits], date_key, date_key)
    journals = _journal_dates(db, user, date_key, date_key)
    notes = _note_dates(db, user, date_key, date_key)

    summary = _summarize_day(
        habits,
        date_key,
        checkins,
        today=today,
        has_journal=date_key in journals,
        has_notes=date_key in notes,
    )

    items: List[CalendarDayHabit] = []
    for habit in habits:
        if not is_habit_scheduled_on_date(habit, date_key):
            continue
        checkin = checkins.get((habit.id, date_key))
        status_value = get_habit_status_for_date(
            habit, date_key, checkin, today=today
        )
        items.append(
            CalendarDayHabit(
                habit_id=habit.id,
                name=habit.name,
                category=habit.category,
                icon=habit.icon,
                frequency=habit.frequency,
                week_day=habit.week_day,
                scheduled=True,
                status=status_value,  # type: ignore[arg-type]
                checkin_id=checkin.id if checkin else None,
                checkin_notes=checkin.notes if checkin else "",
            )
        )

    items.sort(key=lambda item: item.name.lower())
    return DailyCalendarData(date=date_key, summary=summary, habits=items)


def get_monthly_summary(
    db: Session,
    user: User,
    *,
    year: int,
    month: int,
    today: Optional[str] = None,
) -> MonthlyCalendarData:
    if month < 1 or month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="month must be between 1 and 12",
        )
    if year < 1970 or year > 2100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="year is out of supported range",
        )

    today = today or today_key()
    keys = month_date_keys(year, month)
    start, end = keys[0], keys[-1]
    habits = _load_active_habits(db, user)
    checkins = _load_checkin_map(db, [h.id for h in habits], start, end)
    journals = _journal_dates(db, user, start, end)
    notes = _note_dates(db, user, start, end)

    days = [
        _summarize_day(
            habits,
            key,
            checkins,
            today=today,
            has_journal=key in journals,
            has_notes=key in notes,
        )
        for key in keys
    ]
    return MonthlyCalendarData(month=month, year=year, days=days)


def get_date_range_summary(
    db: Session,
    user: User,
    *,
    start_date: str,
    end_date: str,
    today: Optional[str] = None,
) -> CalendarSummaryData:
    today = today or today_key()
    try:
        keys = list(iter_date_keys(start_date, end_date))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    habits = _load_active_habits(db, user)
    checkins = _load_checkin_map(db, [h.id for h in habits], start_date, end_date)

    total_scheduled = completed = pending = missed = 0
    active_days = 0
    trend: List[CalendarTrendPoint] = []
    weekday_rates: Dict[int, List[int]] = defaultdict(list)

    for key in keys:
        summary = _summarize_day(habits, key, checkins, today=today)
        total_scheduled += summary.total_habits
        completed += summary.completed
        pending += summary.pending
        missed += summary.missed
        if summary.total_habits > 0 and not is_future_key(key, today):
            active_days += 1
            weekday_rates[weekday_sun0(parse_date_key(key))].append(
                summary.completion_percentage
            )
        trend.append(
            CalendarTrendPoint(
                date=key,
                scheduled=summary.total_habits,
                completed=summary.completed,
                pending=summary.pending,
                missed=summary.missed,
                completion_percentage=summary.completion_percentage,
            )
        )

    best_day = None
    best_avg = -1.0
    for idx, rates in weekday_rates.items():
        if not rates:
            continue
        avg = sum(rates) / len(rates)
        if avg > best_avg:
            best_avg = avg
            best_day = WEEKDAY_LABELS[idx]

    return CalendarSummaryData(
        start_date=start_date,
        end_date=end_date,
        total_scheduled=total_scheduled,
        completed=completed,
        pending=pending,
        missed=missed,
        completion_percentage=get_completion_percentage(completed, total_scheduled),
        active_days=active_days,
        best_performing_day=best_day,
        daily_trend=trend,
    )
