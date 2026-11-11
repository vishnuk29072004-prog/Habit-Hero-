"""Goal request/response schemas (maps frontend normalizeGoal)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.date_keys import parse_date_key

GOAL_CATEGORIES = (
    "Health",
    "Work",
    "Learning",
    "Productivity",
    "Mental Health",
    "Personal Development",
)

GOAL_TARGET_TYPES = (
    "completion_count",
    "consecutive_days",
    "days_completed",
    "completion_percentage",
)

GoalStatus = Literal[
    "archived",
    "completed",
    "overdue",
    "not_started",
    "in_progress",
]


def _date_key(value: str) -> str:
    try:
        return parse_date_key(value).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


class GoalProgress(BaseModel):
    current: float
    target: int
    rate: int
    unit: str
    label: str
    met: Optional[bool] = None
    actual_rate: Optional[int] = None
    current_streak: Optional[int] = None


class GoalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = "Health"
    icon: str = Field(default="", max_length=64)
    linked_habit_id: Optional[str] = None
    target_type: Literal[
        "completion_count",
        "consecutive_days",
        "days_completed",
        "completion_percentage",
    ] = "completion_count"
    target_value: int = Field(default=1, ge=1)
    start_date: str
    end_date: str
    notes: str = Field(default="", max_length=5000)

    @field_validator("name")
    @classmethod
    def name_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Goal name is required")
        return cleaned

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str) -> str:
        if value not in GOAL_CATEGORIES:
            raise ValueError(
                "Category must be one of: " + ", ".join(GOAL_CATEGORIES)
            )
        return value

    @field_validator("start_date", "end_date")
    @classmethod
    def valid_dates(cls, value: str) -> str:
        return _date_key(value)

    @model_validator(mode="after")
    def end_after_start(self) -> GoalCreate:
        if self.end_date < self.start_date:
            raise ValueError("end_date must not precede start_date")
        if self.target_type == "completion_percentage" and self.target_value > 100:
            raise ValueError("completion_percentage target_value must be 1–100")
        return self


class GoalUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=64)
    linked_habit_id: Optional[str] = None
    clear_linked_habit: bool = False
    target_type: Optional[
        Literal[
            "completion_count",
            "consecutive_days",
            "days_completed",
            "completion_percentage",
        ]
    ] = None
    target_value: Optional[int] = Field(default=None, ge=1)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    archived: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Goal name is required")
        return cleaned

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in GOAL_CATEGORIES:
            raise ValueError(
                "Category must be one of: " + ", ".join(GOAL_CATEGORIES)
            )
        return value

    @field_validator("start_date", "end_date")
    @classmethod
    def valid_dates(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return _date_key(value)


class GoalResponse(BaseModel):
    id: str
    name: str
    description: str
    category: str
    icon: str
    linked_habit_id: Optional[str] = None
    target_type: str
    target_value: int
    start_date: str
    end_date: str
    created_at: str
    notes: str
    archived: bool
    completed_at: Optional[str] = None
    updated_at: str
    status: GoalStatus
    progress: GoalProgress


class GoalListData(BaseModel):
    items: List[GoalResponse]
    total: int
    page: int
    page_size: int


class GoalSummaryData(BaseModel):
    total: int
    active: int
    completed: int
    not_started: int
    overdue: int
    completion_rate: int
    goals: List[GoalResponse]


class GoalApiResponse(BaseModel):
    success: bool = True
    message: str
    data: GoalResponse


class GoalListResponse(BaseModel):
    success: bool = True
    message: str
    data: GoalListData


class GoalSummaryResponse(BaseModel):
    success: bool = True
    message: str
    data: GoalSummaryData


class GoalDeleteResponse(BaseModel):
    success: bool = True
    message: str
    data: dict
