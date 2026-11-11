"""Calendar date helpers using YYYY-MM-DD (no timezone shifting)."""

from __future__ import annotations

from datetime import date, timedelta


def parse_date_key(value: str) -> date:
    return date.fromisoformat(value.strip())


def to_date_key(value: date) -> str:
    return value.isoformat()


def today_key() -> str:
    return date.today().isoformat()


def weekday_sun0(value: date) -> int:
    """Sunday=0 … Saturday=6 (matches frontend date-fns getDay)."""
    return (value.weekday() + 1) % 7


def compare_keys(a: str, b: str) -> int:
    if a < b:
        return -1
    if a > b:
        return 1
    return 0


def is_future_key(key: str, today: str | None = None) -> bool:
    return key > (today or today_key())


def is_past_key(key: str, today: str | None = None) -> bool:
    return key < (today or today_key())


def is_today_key(key: str, today: str | None = None) -> bool:
    return key == (today or today_key())


def iter_date_keys(start_key: str, end_key: str):
    start = parse_date_key(start_key)
    end = parse_date_key(end_key)
    if end < start:
        raise ValueError("end_date must not precede start_date")
    current = start
    while current <= end:
        yield to_date_key(current)
        current += timedelta(days=1)


def month_date_keys(year: int, month: int) -> list[str]:
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)
    return list(iter_date_keys(start.isoformat(), end.isoformat()))
