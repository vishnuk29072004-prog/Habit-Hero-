"""Journal entry CRUD, filters, and summary (separate from day_notes)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.habit import Habit
from app.models.journal import JournalEntry, JournalEntryTag
from app.models.user import User
from app.schemas.journal import (
    JOURNAL_MOODS,
    JOURNAL_TAGS,
    JournalCreate,
    JournalListData,
    JournalMoodCount,
    JournalOverviewData,
    JournalRecentDate,
    JournalResponse,
    JournalSummaryData,
    JournalTagCount,
    JournalUpdate,
)
from app.utils.date_keys import iter_date_keys, parse_date_key, today_key


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _tags_list(entry: JournalEntry) -> List[str]:
    return [t.tag for t in entry.tags]


def to_response(entry: JournalEntry) -> JournalResponse:
    return JournalResponse(
        id=entry.id,
        date=entry.date,
        habit_id=entry.habit_id,
        title=entry.title,
        content=entry.content,
        mood=entry.mood,  # type: ignore[arg-type]
        tags=_tags_list(entry),
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _validate_habit(
    db: Session, user: User, habit_id: Optional[str]
) -> Optional[Habit]:
    if not habit_id:
        return None
    habit = db.scalar(
        select(Habit).where(Habit.id == habit_id, Habit.user_id == user.id)
    )
    if habit is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="habit_id must refer to one of your habits",
        )
    return habit


def _replace_tags(db: Session, entry: JournalEntry, tags: List[str]) -> None:
    """Replace the full tag set. Flush deletes before inserts so overlapping
    tags do not hit uq_journal_entry_tags on SQLite."""
    entry.tags.clear()
    db.flush()
    for tag in tags:
        entry.tags.append(JournalEntryTag(tag=tag))


def _load_habit_names(db: Session, user: User) -> Dict[str, str]:
    rows = db.scalars(select(Habit).where(Habit.user_id == user.id)).all()
    return {h.id: h.name for h in rows}


def get_owned_entry(db: Session, user: User, entry_id: str) -> JournalEntry:
    entry = db.scalar(
        select(JournalEntry)
        .options(selectinload(JournalEntry.tags))
        .where(JournalEntry.id == entry_id, JournalEntry.user_id == user.id)
    )
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Journal entry not found",
        )
    return entry


def create_entry(
    db: Session, user: User, payload: JournalCreate
) -> JournalResponse:
    _validate_habit(db, user, payload.habit_id)
    now = _utcnow_iso()
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        user_id=user.id,
        date=payload.date,
        habit_id=payload.habit_id,
        title=payload.title,
        content=payload.content,
        mood=payload.mood,
        created_at=now,
        updated_at=now,
    )
    db.add(entry)
    db.flush()
    _replace_tags(db, entry, payload.tags)
    db.commit()
    entry = get_owned_entry(db, user, entry.id)
    return to_response(entry)


def list_entries(
    db: Session,
    user: User,
    *,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    mood: Optional[str] = None,
    tag: Optional[str] = None,
    habit_id: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    page_size: int = 20,
) -> JournalListData:
    if start_date:
        try:
            start_date = parse_date_key(start_date).isoformat()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="start_date must be YYYY-MM-DD",
            ) from exc
    if end_date:
        try:
            end_date = parse_date_key(end_date).isoformat()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_date must be YYYY-MM-DD",
            ) from exc
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date must not precede start_date",
        )
    if mood and mood not in JOURNAL_MOODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="mood must be one of: " + ", ".join(JOURNAL_MOODS),
        )
    if tag and tag not in JOURNAL_TAGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tag must be one of: " + ", ".join(JOURNAL_TAGS),
        )
    if sort not in ("newest", "oldest"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sort must be newest or oldest",
        )

    filters = [JournalEntry.user_id == user.id]
    if start_date:
        filters.append(JournalEntry.date >= start_date)
    if end_date:
        filters.append(JournalEntry.date <= end_date)
    if mood:
        filters.append(JournalEntry.mood == mood)
    if habit_id == "general":
        filters.append(JournalEntry.habit_id.is_(None))
    elif habit_id:
        filters.append(JournalEntry.habit_id == habit_id)

    rows = list(
        db.scalars(
            select(JournalEntry)
            .options(selectinload(JournalEntry.tags))
            .where(*filters)
        ).all()
    )

    if tag:
        rows = [r for r in rows if tag in _tags_list(r)]

    q = (search or "").strip().lower()
    if q:
        habit_names = _load_habit_names(db, user)
        filtered = []
        for row in rows:
            hay = " ".join(
                [
                    row.title or "",
                    row.content or "",
                    habit_names.get(row.habit_id or "", ""),
                    *_tags_list(row),
                ]
            ).lower()
            if q in hay:
                filtered.append(row)
        rows = filtered

    reverse = sort != "oldest"
    rows.sort(
        key=lambda r: (r.date, r.created_at),
        reverse=reverse,
    )

    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    total = len(rows)
    start = (page - 1) * page_size
    items = [to_response(r) for r in rows[start : start + page_size]]
    return JournalListData(
        items=items, total=total, page=page, page_size=page_size
    )


def get_entry(db: Session, user: User, entry_id: str) -> JournalResponse:
    return to_response(get_owned_entry(db, user, entry_id))


def update_entry(
    db: Session, user: User, entry_id: str, payload: JournalUpdate
) -> JournalResponse:
    entry = get_owned_entry(db, user, entry_id)
    data = payload.model_dump(exclude_unset=True)
    clear_habit = data.pop("clear_habit", False)

    if clear_habit:
        entry.habit_id = None
    elif "habit_id" in data:
        _validate_habit(db, user, data["habit_id"])
        entry.habit_id = data["habit_id"]

    for field in ("date", "title", "content", "mood"):
        if field in data:
            setattr(entry, field, data[field])

    if "tags" in data:
        _replace_tags(db, entry, data["tags"] or [])

    # Preserve created_at; only bump updated_at.
    entry.updated_at = _utcnow_iso()
    db.add(entry)
    db.commit()
    entry = get_owned_entry(db, user, entry.id)
    return to_response(entry)


def delete_entry(db: Session, user: User, entry_id: str) -> str:
    entry = get_owned_entry(db, user, entry_id)
    deleted_id = entry.id
    db.delete(entry)
    db.commit()
    return deleted_id


def _unique_dates(entries: List[JournalEntry]) -> List[str]:
    return sorted({e.date for e in entries if e.date})


def _current_streak(dates: List[str], today: str) -> int:
    date_set = set(dates)
    streak = 0
    cursor = parse_date_key(today)
    while True:
        key = cursor.isoformat()
        if key not in date_set:
            break
        streak += 1
        cursor -= timedelta(days=1)
        if streak > 730:
            break
    return streak


def _longest_streak(dates: List[str], today: str) -> int:
    past = [d for d in dates if d <= today]
    if not past:
        return 0
    longest = current = 1
    for i in range(1, len(past)):
        prev = parse_date_key(past[i - 1])
        nxt = parse_date_key(past[i])
        if (nxt - prev).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def _monday_week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _overview_range(period: str, today: str) -> tuple[str, str]:
    today_d = parse_date_key(today)
    if period == "thisWeek":
        start = _monday_week_start(today_d)
        end = today_d
    elif period == "lastMonth":
        first_this = date(today_d.year, today_d.month, 1)
        last_prev = first_this - timedelta(days=1)
        start = date(last_prev.year, last_prev.month, 1)
        end = last_prev
    elif period == "thisYear":
        start = date(today_d.year, 1, 1)
        end = today_d
    else:  # thisMonth
        start = date(today_d.year, today_d.month, 1)
        end = today_d

    if end > today_d:
        end = today_d
    if start > end:
        return today, today
    return start.isoformat(), end.isoformat()


def _compute_overview(
    entries: List[JournalEntry], period: str, today: str
) -> JournalOverviewData:
    start, end = _overview_range(period, today)
    if start > end:
        return JournalOverviewData(
            period=period,  # type: ignore[arg-type]
            start_date=start,
            end_date=end,
            journaled_days=0,
            missed_days=0,
            total_days=0,
            rate=0,
        )
    date_set = {e.date for e in entries}
    journaled = missed = 0
    for key in iter_date_keys(start, end):
        if key > today:
            continue
        if key in date_set:
            journaled += 1
        else:
            missed += 1
    total = journaled + missed
    return JournalOverviewData(
        period=period,  # type: ignore[arg-type]
        start_date=start,
        end_date=end,
        journaled_days=journaled,
        missed_days=missed,
        total_days=total,
        rate=round((journaled / total) * 100) if total else 0,
    )


def get_summary(
    db: Session,
    user: User,
    *,
    period: str = "thisMonth",
    today: Optional[str] = None,
) -> JournalSummaryData:
    if period not in ("thisWeek", "thisMonth", "lastMonth", "thisYear"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="period must be thisWeek, thisMonth, lastMonth, or thisYear",
        )
    today = today or today_key()
    rows = list(
        db.scalars(
            select(JournalEntry)
            .options(selectinload(JournalEntry.tags))
            .where(JournalEntry.user_id == user.id)
        ).all()
    )
    dates = _unique_dates(rows)

    mood_counts = {m: 0 for m in JOURNAL_MOODS}
    tag_counts = {t: 0 for t in JOURNAL_TAGS}
    date_counts: Dict[str, int] = {}
    for row in rows:
        mood_counts[row.mood] = mood_counts.get(row.mood, 0) + 1
        date_counts[row.date] = date_counts.get(row.date, 0) + 1
        for tag in _tags_list(row):
            if tag in tag_counts:
                tag_counts[tag] += 1

    recent = [
        JournalRecentDate(date=d, count=c)
        for d, c in sorted(
            date_counts.items(), key=lambda item: item[0], reverse=True
        )[:5]
    ]

    return JournalSummaryData(
        total_entries=len(rows),
        active_days=len(dates),
        current_streak=_current_streak(dates, today),
        longest_streak=_longest_streak(dates, today),
        overview=_compute_overview(rows, period, today),
        mood_breakdown=[
            JournalMoodCount(mood=m, count=mood_counts[m])  # type: ignore[arg-type]
            for m in JOURNAL_MOODS
            if mood_counts[m]
        ],
        tag_breakdown=[
            JournalTagCount(tag=t, count=tag_counts[t])
            for t in JOURNAL_TAGS
            if tag_counts[t]
        ],
        recent_dates=recent,
        moods=list(JOURNAL_MOODS),
        tags=list(JOURNAL_TAGS),
    )
