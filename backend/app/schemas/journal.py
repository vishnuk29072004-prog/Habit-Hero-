"""Journal entry request/response schemas (frontend journalCalculations.js)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.date_keys import parse_date_key

JOURNAL_MOODS = (
    "happy",
    "productive",
    "motivated",
    "neutral",
    "tired",
    "stressed",
    "sad",
)

JOURNAL_TAGS = (
    "Productivity",
    "Health",
    "Learning",
    "Personal Growth",
    "Motivation",
    "Reflection",
)

JOURNAL_PERIODS = (
    "thisWeek",
    "thisMonth",
    "lastMonth",
    "thisYear",
)

JournalMood = Literal[
    "happy",
    "productive",
    "motivated",
    "neutral",
    "tired",
    "stressed",
    "sad",
]

JournalPeriod = Literal["thisWeek", "thisMonth", "lastMonth", "thisYear"]
JournalSort = Literal["newest", "oldest"]


def _date_key(value: str) -> str:
    try:
        return parse_date_key(value).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


def _normalize_tags(tags: Optional[List[str]]) -> List[str]:
    if not tags:
        return []
    seen: set[str] = set()
    cleaned: List[str] = []
    for tag in tags:
        if tag not in JOURNAL_TAGS:
            raise ValueError(
                "Tag must be one of: " + ", ".join(JOURNAL_TAGS)
            )
        if tag not in seen:
            seen.add(tag)
            cleaned.append(tag)
    return cleaned


class JournalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    title: str = Field(default="", max_length=200)
    content: str = Field(..., min_length=1, max_length=20000)
    mood: JournalMood = "neutral"
    tags: List[str] = Field(default_factory=list)
    habit_id: Optional[str] = None

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        return _date_key(value)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: str) -> str:
        return value.strip()

    @field_validator("content")
    @classmethod
    def content_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Journal content is required")
        return cleaned

    @field_validator("tags")
    @classmethod
    def valid_tags(cls, value: List[str]) -> List[str]:
        return _normalize_tags(value)


class JournalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=200)
    content: Optional[str] = Field(default=None, max_length=20000)
    mood: Optional[JournalMood] = None
    tags: Optional[List[str]] = None
    habit_id: Optional[str] = None
    clear_habit: bool = False

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _date_key(value)

    @field_validator("title")
    @classmethod
    def trim_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Journal content is required")
        return cleaned

    @field_validator("tags")
    @classmethod
    def valid_tags(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return value
        return _normalize_tags(value)

    @model_validator(mode="after")
    def at_least_one_field(self) -> JournalUpdate:
        data = self.model_dump(exclude_unset=True)
        data.pop("clear_habit", None)
        if self.clear_habit:
            return self
        if not data:
            raise ValueError("No journal fields provided")
        return self


class JournalResponse(BaseModel):
    id: str
    date: str
    habit_id: Optional[str] = None
    title: str
    content: str
    mood: JournalMood
    tags: List[str]
    created_at: str
    updated_at: str


class JournalListData(BaseModel):
    items: List[JournalResponse]
    total: int
    page: int
    page_size: int


class JournalOverviewData(BaseModel):
    period: JournalPeriod
    start_date: str
    end_date: str
    journaled_days: int
    missed_days: int
    total_days: int
    rate: int


class JournalMoodCount(BaseModel):
    mood: JournalMood
    count: int


class JournalTagCount(BaseModel):
    tag: str
    count: int


class JournalRecentDate(BaseModel):
    date: str
    count: int


class JournalSummaryData(BaseModel):
    total_entries: int
    active_days: int
    current_streak: int
    longest_streak: int
    overview: JournalOverviewData
    mood_breakdown: List[JournalMoodCount]
    tag_breakdown: List[JournalTagCount]
    recent_dates: List[JournalRecentDate]
    moods: List[str]
    tags: List[str]


class JournalApiResponse(BaseModel):
    success: bool = True
    message: str
    data: JournalResponse


class JournalListResponse(BaseModel):
    success: bool = True
    message: str
    data: JournalListData


class JournalSummaryResponse(BaseModel):
    success: bool = True
    message: str
    data: JournalSummaryData


class JournalDeleteResponse(BaseModel):
    success: bool = True
    message: str
    data: dict
