"""Analytics response schemas (derived; no analytics tables)."""

from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class OccurrenceStats(BaseModel):
    scheduled: int = 0
    completed: int = 0
    missed: int = 0
    pending: int = 0
    completion_percentage: int = 0


class DayTrendPoint(BaseModel):
    date: str
    scheduled: int
    completed: int
    missed: int
    pending: int
    completion_percentage: int
    is_future: bool = False


class WeekBucket(BaseModel):
    week_start: str
    week_end: str
    scheduled: int
    completed: int
    missed: int
    pending: int
    completion_percentage: int


class HabitBrief(BaseModel):
    id: str
    name: str
    category: str
    icon: str
    frequency: str
    is_archived: bool


class OverviewAnalytics(BaseModel):
    total_habits: int
    active_habits: int
    archived_habits: int
    total_completed_checkins: int
    today_scheduled: int
    today_completed: int
    today_completion_percentage: int
    overall_scheduled: int
    overall_completed: int
    overall_completion_percentage: int
    current_streak: int
    longest_streak: int
    as_of: str


class HabitAnalyticsData(BaseModel):
    habit: HabitBrief
    total_scheduled: int
    total_completed: int
    total_missed: int
    total_pending: int
    completion_percentage: int
    current_streak: int
    longest_streak: int
    first_completion_date: Optional[str] = None
    latest_completion_date: Optional[str] = None
    weekly_performance: List[WeekBucket]
    monthly_performance: OccurrenceStats
    daily_trend: List[DayTrendPoint]
    range_start: str
    range_end: str


class WeeklyAnalyticsData(BaseModel):
    week_start: str
    week_end: str
    total_scheduled: int
    completed: int
    missed: int
    pending: int
    completion_percentage: int
    days: List[DayTrendPoint]


class MonthlyAnalyticsData(BaseModel):
    month: int
    year: int
    total_scheduled: int
    completed: int
    missed: int
    pending: int
    completion_percentage: int
    daily_trend: List[DayTrendPoint]
    weekly_breakdown: List[WeekBucket]
    habit_performance: List[dict]


class CategoryAnalyticsItem(BaseModel):
    category: str
    habit_count: int
    scheduled: int
    completed: int
    missed: int
    completion_percentage: int


class CategoryAnalyticsData(BaseModel):
    start_date: str
    end_date: str
    categories: List[CategoryAnalyticsItem]


class BestDayItem(BaseModel):
    weekday: str
    weekday_index: int = Field(..., ge=0, le=6, description="Sun=0 … Sat=6")
    scheduled: int
    completed: int
    completion_percentage: int
    rank: int


class BestDaysData(BaseModel):
    start_date: str
    end_date: str
    days: List[BestDayItem]


class HabitStreakItem(BaseModel):
    habit_id: str
    name: str
    current_streak: int
    longest_streak: int


class StreakAnalyticsData(BaseModel):
    current_streak: int
    longest_streak: int
    per_habit: List[HabitStreakItem]
    best_performing_habit: Optional[HabitStreakItem] = None
    as_of: str


class AnalyticsApiResponse(BaseModel):
    success: bool = True
    message: str
    data: Any
