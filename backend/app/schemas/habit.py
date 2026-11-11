"""Habit request/response schemas (maps frontend normalizeHabit fields)."""

from __future__ import annotations

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HABIT_CATEGORIES = (
    "Health",
    "Work",
    "Learning",
    "Productivity",
    "Mental Health",
)

HABIT_FREQUENCIES = ("Daily", "Weekly")

StatusFilter = Literal["active", "archived", "all"]


def _parse_date_key(value: str) -> str:
    cleaned = value.strip()
    try:
        return date.fromisoformat(cleaned).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


class HabitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=5000)
    icon: str = Field(default="sparkles", min_length=1, max_length=64)
    category: str = Field(default="Health")
    frequency: Literal["Daily", "Weekly"] = "Daily"
    start_date: str
    week_day: Optional[int] = Field(default=None, ge=0, le=6)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Habit name is required")
        return cleaned

    @field_validator("description", "notes")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str) -> str:
        # Frontend migrateCategory: Lifestyle → Mental Health
        if value == "Lifestyle":
            value = "Mental Health"
        if value not in HABIT_CATEGORIES:
            raise ValueError(
                "Category must be one of: " + ", ".join(HABIT_CATEGORIES)
            )
        return value

    @field_validator("start_date")
    @classmethod
    def valid_start_date(cls, value: str) -> str:
        return _parse_date_key(value)

    @model_validator(mode="after")
    def validate_schedule(self) -> HabitCreate:
        if self.frequency == "Weekly":
            if self.week_day is None:
                # Match frontend: derive from start_date weekday (Mon=0 in ISO;
                # frontend uses date-fns getDay Sun=0). Store Sun=0..Sat=6.
                parsed = date.fromisoformat(self.start_date)
                self.week_day = (parsed.weekday() + 1) % 7  # Mon=0 → 1 ... Sun=6 → 0
        else:
            self.week_day = None
        return self


class HabitUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    notes: Optional[str] = Field(default=None, max_length=5000)
    icon: Optional[str] = Field(default=None, min_length=1, max_length=64)
    category: Optional[str] = None
    frequency: Optional[Literal["Daily", "Weekly"]] = None
    start_date: Optional[str] = None
    week_day: Optional[int] = Field(default=None, ge=0, le=6)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Habit name is required")
        return cleaned

    @field_validator("description", "notes")
    @classmethod
    def strip_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value == "Lifestyle":
            value = "Mental Health"
        if value not in HABIT_CATEGORIES:
            raise ValueError(
                "Category must be one of: " + ", ".join(HABIT_CATEGORIES)
            )
        return value

    @field_validator("start_date")
    @classmethod
    def valid_start_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _parse_date_key(value)


class HabitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    notes: str
    icon: str
    category: str
    frequency: str
    start_date: str
    week_day: Optional[int] = None
    is_archived: bool
    is_active: bool
    created_at: str
    updated_at: str


class HabitListData(BaseModel):
    items: List[HabitResponse]
    total: int
    page: int
    page_size: int


class HabitApiResponse(BaseModel):
    success: bool = True
    message: str
    data: HabitResponse


class HabitListResponse(BaseModel):
    success: bool = True
    message: str
    data: HabitListData


class HabitDetailResponse(HabitApiResponse):
    """Alias for single-habit detail responses."""


class HabitDeleteData(BaseModel):
    id: str
    action: Literal["deleted", "archived"]
    habit: Optional[HabitResponse] = None


class HabitDeleteResponse(BaseModel):
    success: bool = True
    message: str
    data: HabitDeleteData
