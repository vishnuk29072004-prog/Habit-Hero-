"""AI feature request/response schemas (habit suggestions, mood analysis)."""

from __future__ import annotations

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.habit import HABIT_CATEGORIES, HABIT_FREQUENCIES

HabitFrequency = Literal["Daily", "Weekly"]


def _normalize_frequency(value: str) -> str:
    cleaned = (value or "").strip()
    lowered = cleaned.lower()
    if lowered == "daily":
        return "Daily"
    if lowered == "weekly":
        return "Weekly"
    if cleaned in HABIT_FREQUENCIES:
        return cleaned
    raise ValueError("frequency must be Daily or Weekly")


def _normalize_category(value: str) -> str:
    cleaned = (value or "").strip()
    if cleaned == "Lifestyle":
        cleaned = "Mental Health"
    if cleaned not in HABIT_CATEGORIES:
        raise ValueError(
            "Category must be one of: " + ", ".join(HABIT_CATEGORIES)
        )
    return cleaned


def _parse_date_key(value: str) -> str:
    cleaned = (value or "").strip()
    try:
        return date.fromisoformat(cleaned).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


class HabitSuggestionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str
    frequency: HabitFrequency
    reason: str = Field(default="", max_length=2000)
    recommended_start_date: str

    @field_validator("name", "description", "reason")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator("category")
    @classmethod
    def valid_category(cls, value: str) -> str:
        return _normalize_category(value)

    @field_validator("frequency", mode="before")
    @classmethod
    def valid_frequency(cls, value: str) -> str:
        return _normalize_frequency(str(value))

    @field_validator("recommended_start_date")
    @classmethod
    def valid_start_date(cls, value: str) -> str:
        return _parse_date_key(value)


class HabitSuggestionsLLMResponse(BaseModel):
    """Schema passed to Gemini structured output."""

    model_config = ConfigDict(extra="ignore")

    suggestions: List[HabitSuggestionItem] = Field(default_factory=list)


class HabitSuggestionsData(BaseModel):
    suggestions: List[HabitSuggestionItem]
    count: int

    @model_validator(mode="after")
    def sync_count(self) -> HabitSuggestionsData:
        self.count = len(self.suggestions)
        return self


class HabitSuggestionsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    count: int = Field(default=5, ge=1, le=5)


class HabitSuggestionsApiResponse(BaseModel):
    success: bool = True
    message: str
    data: HabitSuggestionsData


# --- Journal mood analysis (Stage D) ---

MIN_JOURNAL_ENTRIES_FOR_ANALYSIS = 3


class MoodAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_date: str
    end_date: str

    @field_validator("start_date", "end_date")
    @classmethod
    def valid_dates(cls, value: str) -> str:
        return _parse_date_key(value)

    @model_validator(mode="after")
    def range_order(self) -> MoodAnalysisRequest:
        if self.end_date < self.start_date:
            raise ValueError("end_date must not precede start_date")
        return self


class MoodPatterns(BaseModel):
    model_config = ConfigDict(extra="ignore")

    positive: List[str] = Field(default_factory=list)
    challenging: List[str] = Field(default_factory=list)

    @field_validator("positive", "challenging", mode="before")
    @classmethod
    def coerce_list(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            cleaned = value.strip()
            return [cleaned] if cleaned else []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        return []


class AnalysisPeriod(BaseModel):
    start_date: str
    end_date: str


class MoodAnalysisLLMResponse(BaseModel):
    """Schema passed to Gemini structured output."""

    model_config = ConfigDict(extra="ignore")

    overall_mood: str = Field(..., min_length=1, max_length=200)
    mood_summary: str = Field(default="", max_length=4000)
    mood_patterns: MoodPatterns = Field(default_factory=MoodPatterns)
    motivation_patterns: List[str] = Field(default_factory=list)
    positive_observations: List[str] = Field(default_factory=list)
    areas_to_improve: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    summary: str = Field(default="", max_length=4000)

    @field_validator(
        "overall_mood",
        "mood_summary",
        "summary",
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        return (value or "").strip()

    @field_validator(
        "motivation_patterns",
        "positive_observations",
        "areas_to_improve",
        "recommendations",
        mode="before",
    )
    @classmethod
    def coerce_str_lists(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            cleaned = value.strip()
            return [cleaned] if cleaned else []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        return []


class MoodAnalysisData(BaseModel):
    overall_mood: str
    mood_summary: str
    mood_patterns: MoodPatterns
    motivation_patterns: List[str]
    positive_observations: List[str]
    areas_to_improve: List[str]
    recommendations: List[str]
    summary: str
    entries_analyzed: int
    analysis_period: AnalysisPeriod


class MoodAnalysisApiResponse(BaseModel):
    success: bool = True
    message: str
    data: MoodAnalysisData
