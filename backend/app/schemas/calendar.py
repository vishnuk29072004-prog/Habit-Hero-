from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.date_keys import parse_date_key

DayHabitStatus = Literal["completed", "pending", "missed", "not_scheduled"]


def _date_key(value: str) -> str:
    try:
        return parse_date_key(value).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


class CalendarDayHabit(BaseModel):
    habit_id: str
    name: str
    category: str
    icon: str
    frequency: str
    week_day: Optional[int] = None
    scheduled: bool
    status: DayHabitStatus
    checkin_id: Optional[int] = None
    checkin_notes: str = ""


class CalendarDaySummary(BaseModel):
    date: str
    total_habits: int
    completed: int
    pending: int
    missed: int
    completion_percentage: int
    has_journal: bool = False
    has_notes: bool = False


class MonthlyCalendarData(BaseModel):
    month: int
    year: int
    days: List[CalendarDaySummary]


class DailyCalendarData(BaseModel):
    date: str
    summary: CalendarDaySummary
    habits: List[CalendarDayHabit]


class CalendarTrendPoint(BaseModel):
    date: str
    scheduled: int
    completed: int
    pending: int
    missed: int
    completion_percentage: int


class CalendarSummaryData(BaseModel):
    start_date: str
    end_date: str
    total_scheduled: int
    completed: int
    pending: int
    missed: int
    completion_percentage: int
    active_days: int
    best_performing_day: Optional[str] = None
    daily_trend: List[CalendarTrendPoint]


class MonthlyCalendarResponse(BaseModel):
    success: bool = True
    message: str
    data: MonthlyCalendarData


class DailyCalendarResponse(BaseModel):
    success: bool = True
    message: str
    data: DailyCalendarData


class CalendarSummaryResponse(BaseModel):
    success: bool = True
    message: str
    data: CalendarSummaryData


class DayNoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    notes: str = Field(..., min_length=1, max_length=10000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        return _date_key(value)

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Notes cannot be empty")
        return cleaned


class DayNoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str = Field(..., min_length=1, max_length=10000)

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Notes cannot be empty")
        return cleaned


class DayNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: str
    notes: str
    updated_at: str


class DayNoteApiResponse(BaseModel):
    success: bool = True
    message: str
    data: DayNoteResponse


class DayNoteListResponse(BaseModel):
    success: bool = True
    message: str
    data: List[DayNoteResponse]


class DayNoteDeleteResponse(BaseModel):
    success: bool = True
    message: str
    data: dict
