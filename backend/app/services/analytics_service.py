"""Analytics aggregates derived from habits + check-ins (no analytics tables)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Callable, Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.habit import Habit, HabitCheckin
from app.models.user import User
from app.schemas.analytics import (
    BestDayItem,
    BestDaysData,
    CategoryAnalyticsData,
    CategoryAnalyticsItem,
    DayTrendPoint,
    HabitAnalyticsData,
    HabitBrief,
    HabitStreakItem,
    MonthlyAnalyticsData,
    OccurrenceStats,
    OverviewAnalytics,
    StreakAnalyticsData,
    WeekBucket,
    WeeklyAnalyticsData,
)
from app.schemas.habit import HABIT_CATEGORIES
from app.services import habit_service
from app.utils.date_keys import (
    is_future_key,
    iter_date_keys,
    month_date_keys,
    parse_date_key,
    to_date_key,
    today_key,
    weekday_sun0,
)
from app.utils.habit_schedule import is_habit_scheduled_on_date
from app.utils.streak_calculations import (
    completion_percentage,
    get_current_streak,
    get_longest_streak,
)

WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]


def _load_habits(
    db: Session, user: User, *, active_only: bool = False
) -> List[Habit]:
    stmt = select(Habit).where(Habit.user_id == user.id)
    if active_only:
        stmt = stmt.where(Habit.archived == 0)
    return list(db.scalars(stmt.order_by(Habit.name.asc())).all())


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


def _completed_lookup(
    checkins: Dict[Tuple[str, str], HabitCheckin],
) -> Callable[[Habit, str], bool]:
    def is_completed(habit: Habit, date_key: str) -> bool:
        row = checkins.get((habit.id, date_key))
        return row is not None and int(row.completed) == 1

    return is_completed


def _habit_status(
    habit: Habit,
    date_key: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> str:
    if not is_habit_scheduled_on_date(habit, date_key):
        return "not_scheduled"
    row = checkins.get((habit.id, date_key))
    if row is not None and int(row.completed) == 1:
        return "completed"
    if is_future_key(date_key, today) or date_key == today:
        return "pending"
    return "missed"


def _range_stats(
    habits: Iterable[Habit],
    start: str,
    end: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    *,
    today: str,
) -> OccurrenceStats:
    scheduled = completed = missed = pending = 0
    for key in iter_date_keys(start, end):
        for habit in habits:
            status_value = _habit_status(habit, key, checkins, today)
            if status_value == "not_scheduled":
                continue
            scheduled += 1
            if status_value == "completed":
                completed += 1
            elif status_value == "pending":
                pending += 1
            elif status_value == "missed":
                missed += 1
    return OccurrenceStats(
        scheduled=scheduled,
        completed=completed,
        missed=missed,
        pending=pending,
        completion_percentage=completion_percentage(completed, scheduled),
    )


def _day_point(
    habits: Iterable[Habit],
    date_key: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> DayTrendPoint:
    scheduled = completed = missed = pending = 0
    for habit in habits:
        status_value = _habit_status(habit, date_key, checkins, today)
        if status_value == "not_scheduled":
            continue
        scheduled += 1
        if status_value == "completed":
            completed += 1
        elif status_value == "pending":
            pending += 1
        else:
            missed += 1
    return DayTrendPoint(
        date=date_key,
        scheduled=scheduled,
        completed=completed,
        missed=missed,
        pending=pending,
        completion_percentage=completion_percentage(completed, scheduled),
        is_future=is_future_key(date_key, today),
    )


def _monday_of(date_key: str) -> date:
    d = parse_date_key(date_key)
    # Monday = 0 in ISO weekday
    return d - timedelta(days=d.weekday())


def _week_bounds(anchor: str) -> tuple[str, str]:
    monday = _monday_of(anchor)
    sunday = monday + timedelta(days=6)
    return to_date_key(monday), to_date_key(sunday)


def _weekly_buckets(
    habits: Iterable[Habit],
    start: str,
    end: str,
    checkins: Dict[Tuple[str, str], HabitCheckin],
    today: str,
) -> List[WeekBucket]:
    buckets: List[WeekBucket] = []
    cursor = _monday_of(start)
    end_date = parse_date_key(end)
    while cursor <= end_date:
        week_start = to_date_key(cursor)
        week_end = to_date_key(cursor + timedelta(days=6))
        # Clip to requested range
        clip_start = max(week_start, start)
        clip_end = min(week_end, end)
        stats = _range_stats(habits, clip_start, clip_end, checkins, today=today)
        buckets.append(
            WeekBucket(
                week_start=clip_start,
                week_end=clip_end,
                scheduled=stats.scheduled,
                completed=stats.completed,
                missed=stats.missed,
                pending=stats.pending,
                completion_percentage=stats.completion_percentage,
            )
        )
        cursor += timedelta(days=7)
    return buckets


def _habit_brief(habit: Habit) -> HabitBrief:
    return HabitBrief(
        id=habit.id,
        name=habit.name,
        category=habit.category,
        icon=habit.icon,
        frequency=habit.frequency,
        is_archived=bool(habit.archived),
    )


def get_overview(db: Session, user: User, *, today: Optional[str] = None) -> OverviewAnalytics:
    today = today or today_key()
    all_habits = _load_habits(db, user, active_only=False)
    active = [h for h in all_habits if int(h.archived) == 0]
    archived = [h for h in all_habits if int(h.archived) == 1]

    total_completed = (
        db.scalar(
            select(func.count())
            .select_from(HabitCheckin)
            .join(Habit, Habit.id == HabitCheckin.habit_id)
            .where(Habit.user_id == user.id, HabitCheckin.completed == 1)
        )
        or 0
    )

    # Overall window: earliest start_date among active habits → today
    if active:
        start = min(h.start_date for h in active)
    else:
        start = today

    checkins = _load_checkin_map(db, [h.id for h in active], start, today)
    # Extend map for streak lookback
    lookback_start = to_date_key(parse_date_key(today) - timedelta(days=400))
    streak_checkins = _load_checkin_map(
        db, [h.id for h in active], lookback_start, today
    )
    checkins.update(streak_checkins)

    today_stats = _day_point(active, today, checkins, today)
    overall = _range_stats(active, start, today, checkins, today=today)
    is_completed = _completed_lookup(checkins)

    return OverviewAnalytics(
        total_habits=len(all_habits),
        active_habits=len(active),
        archived_habits=len(archived),
        total_completed_checkins=int(total_completed),
        today_scheduled=today_stats.scheduled,
        today_completed=today_stats.completed,
        today_completion_percentage=today_stats.completion_percentage,
        overall_scheduled=overall.scheduled,
        overall_completed=overall.completed,
        overall_completion_percentage=overall.completion_percentage,
        current_streak=get_current_streak(
            active, is_completed=is_completed, as_of=today
        ),
        longest_streak=get_longest_streak(
            active, is_completed=is_completed, as_of=today, lookback_days=365
        ),
        as_of=today,
    )


def get_habit_analytics(
    db: Session,
    user: User,
    habit_id: str,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    today: Optional[str] = None,
) -> HabitAnalyticsData:
    today = today or today_key()
    habit = habit_service.get_owned_habit(db, user, habit_id)
    start = start_date or habit.start_date
    end = end_date or today
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not precede start_date",
        )

    # Include archived habit for historical analytics when requested by ID
    habits = [habit]
    lookback_start = to_date_key(parse_date_key(today) - timedelta(days=400))
    load_start = min(start, lookback_start)
    checkins = _load_checkin_map(db, [habit.id], load_start, max(end, today))
    is_completed = _completed_lookup(checkins)

    stats = _range_stats(habits, start, end, checkins, today=today)
    daily = [_day_point(habits, key, checkins, today) for key in iter_date_keys(start, end)]
    weekly = _weekly_buckets(habits, start, end, checkins, today)

    # Monthly performance = full requested range stats (named for API parity)
    completed_dates = sorted(
        key
        for (hid, key), row in checkins.items()
        if hid == habit.id and int(row.completed) == 1 and start <= key <= end
    )

    return HabitAnalyticsData(
        habit=_habit_brief(habit),
        total_scheduled=stats.scheduled,
        total_completed=stats.completed,
        total_missed=stats.missed,
        total_pending=stats.pending,
        completion_percentage=stats.completion_percentage,
        current_streak=get_current_streak(
            habits, is_completed=is_completed, as_of=today
        ),
        longest_streak=get_longest_streak(
            habits, is_completed=is_completed, as_of=today, lookback_days=365
        ),
        first_completion_date=completed_dates[0] if completed_dates else None,
        latest_completion_date=completed_dates[-1] if completed_dates else None,
        weekly_performance=weekly,
        monthly_performance=stats,
        daily_trend=daily,
        range_start=start,
        range_end=end,
    )


def get_weekly_analytics(
    db: Session,
    user: User,
    *,
    date: Optional[str] = None,
    today: Optional[str] = None,
) -> WeeklyAnalyticsData:
    today = today or today_key()
    anchor = date or today
    week_start, week_end = _week_bounds(anchor)
    habits = _load_habits(db, user, active_only=True)
    checkins = _load_checkin_map(db, [h.id for h in habits], week_start, week_end)
    days = [
        _day_point(habits, key, checkins, today)
        for key in iter_date_keys(week_start, week_end)
    ]
    stats = _range_stats(habits, week_start, week_end, checkins, today=today)
    return WeeklyAnalyticsData(
        week_start=week_start,
        week_end=week_end,
        total_scheduled=stats.scheduled,
        completed=stats.completed,
        missed=stats.missed,
        pending=stats.pending,
        completion_percentage=stats.completion_percentage,
        days=days,
    )


def get_monthly_analytics(
    db: Session,
    user: User,
    *,
    month: int,
    year: int,
    today: Optional[str] = None,
) -> MonthlyAnalyticsData:
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
    habits = _load_habits(db, user, active_only=True)
    checkins = _load_checkin_map(db, [h.id for h in habits], start, end)
    daily = [_day_point(habits, key, checkins, today) for key in keys]
    weekly = _weekly_buckets(habits, start, end, checkins, today)
    stats = _range_stats(habits, start, end, checkins, today=today)

    habit_performance = []
    for habit in habits:
        hstats = _range_stats([habit], start, end, checkins, today=today)
        if hstats.scheduled == 0:
            continue
        habit_performance.append(
            {
                "habit_id": habit.id,
                "name": habit.name,
                "category": habit.category,
                "icon": habit.icon,
                "scheduled": hstats.scheduled,
                "completed": hstats.completed,
                "missed": hstats.missed,
                "pending": hstats.pending,
                "completion_percentage": hstats.completion_percentage,
            }
        )
    habit_performance.sort(
        key=lambda x: (-x["completion_percentage"], -x["completed"], x["name"])
    )

    return MonthlyAnalyticsData(
        month=month,
        year=year,
        total_scheduled=stats.scheduled,
        completed=stats.completed,
        missed=stats.missed,
        pending=stats.pending,
        completion_percentage=stats.completion_percentage,
        daily_trend=daily,
        weekly_breakdown=weekly,
        habit_performance=habit_performance,
    )


def get_category_analytics(
    db: Session,
    user: User,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    today: Optional[str] = None,
) -> CategoryAnalyticsData:
    today = today or today_key()
    habits = _load_habits(db, user, active_only=True)
    start = start_date or (min((h.start_date for h in habits), default=today))
    end = end_date or today
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not precede start_date",
        )
    checkins = _load_checkin_map(db, [h.id for h in habits], start, end)

    by_cat: Dict[str, dict] = {
        name: {
            "habit_ids": set(),
            "scheduled": 0,
            "completed": 0,
            "missed": 0,
        }
        for name in HABIT_CATEGORIES
    }

    for habit in habits:
        cat = habit.category if habit.category in by_cat else "Health"
        by_cat[cat]["habit_ids"].add(habit.id)
        for key in iter_date_keys(start, end):
            status_value = _habit_status(habit, key, checkins, today)
            if status_value == "not_scheduled":
                continue
            by_cat[cat]["scheduled"] += 1
            if status_value == "completed":
                by_cat[cat]["completed"] += 1
            elif status_value == "missed":
                by_cat[cat]["missed"] += 1

    categories = []
    for name in HABIT_CATEGORIES:
        bucket = by_cat[name]
        if bucket["scheduled"] == 0 and not bucket["habit_ids"]:
            continue
        if bucket["scheduled"] == 0:
            continue
        categories.append(
            CategoryAnalyticsItem(
                category=name,
                habit_count=len(bucket["habit_ids"]),
                scheduled=bucket["scheduled"],
                completed=bucket["completed"],
                missed=bucket["missed"],
                completion_percentage=completion_percentage(
                    bucket["completed"], bucket["scheduled"]
                ),
            )
        )
    return CategoryAnalyticsData(
        start_date=start, end_date=end, categories=categories
    )


def get_best_days(
    db: Session,
    user: User,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    today: Optional[str] = None,
) -> BestDaysData:
    today = today or today_key()
    habits = _load_habits(db, user, active_only=True)
    start = start_date or (min((h.start_date for h in habits), default=today))
    end = end_date or today
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not precede start_date",
        )
    checkins = _load_checkin_map(db, [h.id for h in habits], start, end)

    buckets = [
        {"scheduled": 0, "completed": 0, "rates": []} for _ in range(7)
    ]
    for key in iter_date_keys(start, end):
        if is_future_key(key, today):
            continue
        point = _day_point(habits, key, checkins, today)
        if point.scheduled == 0:
            continue
        idx = weekday_sun0(parse_date_key(key))
        buckets[idx]["scheduled"] += point.scheduled
        buckets[idx]["completed"] += point.completed
        buckets[idx]["rates"].append(point.completion_percentage)

    ranked = []
    for idx, bucket in enumerate(buckets):
        if bucket["scheduled"] == 0:
            continue
        pct = completion_percentage(bucket["completed"], bucket["scheduled"])
        ranked.append(
            {
                "weekday": WEEKDAY_LABELS[idx],
                "weekday_index": idx,
                "scheduled": bucket["scheduled"],
                "completed": bucket["completed"],
                "completion_percentage": pct,
            }
        )
    ranked.sort(
        key=lambda x: (-x["completion_percentage"], -x["completed"], x["weekday_index"])
    )
    days = [
        BestDayItem(**item, rank=i + 1) for i, item in enumerate(ranked)
    ]
    return BestDaysData(start_date=start, end_date=end, days=days)


def get_streak_analytics(
    db: Session, user: User, *, today: Optional[str] = None
) -> StreakAnalyticsData:
    today = today or today_key()
    habits = _load_habits(db, user, active_only=True)
    lookback_start = to_date_key(parse_date_key(today) - timedelta(days=400))
    checkins = _load_checkin_map(db, [h.id for h in habits], lookback_start, today)
    is_completed = _completed_lookup(checkins)

    overall_current = get_current_streak(
        habits, is_completed=is_completed, as_of=today
    )
    overall_longest = get_longest_streak(
        habits, is_completed=is_completed, as_of=today, lookback_days=365
    )

    per_habit: List[HabitStreakItem] = []
    for habit in habits:
        solo = [habit]
        item = HabitStreakItem(
            habit_id=habit.id,
            name=habit.name,
            current_streak=get_current_streak(
                solo, is_completed=is_completed, as_of=today
            ),
            longest_streak=get_longest_streak(
                solo, is_completed=is_completed, as_of=today, lookback_days=365
            ),
        )
        per_habit.append(item)

    per_habit.sort(
        key=lambda x: (-x.current_streak, -x.longest_streak, x.name.lower())
    )
    best = per_habit[0] if per_habit and (
        per_habit[0].current_streak > 0 or per_habit[0].longest_streak > 0
    ) else (per_habit[0] if per_habit else None)

    return StreakAnalyticsData(
        current_streak=overall_current,
        longest_streak=overall_longest,
        per_habit=per_habit,
        best_performing_habit=best,
        as_of=today,
    )
