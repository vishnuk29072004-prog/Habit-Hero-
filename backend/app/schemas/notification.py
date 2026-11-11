"""Notification inbox schemas (frontend PageHeaderTools mock shape)."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

NotificationType = Literal[
    "habit_daily_reminder",
    "habit_weekly_reminder",
    "habit_upcoming",
    "habit_overdue",
    "goal_deadline",
    "goal_overdue",
    "streak_milestone",
    "weekly_summary",
]


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    message: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    unread: bool
    created_at: str
    read_at: Optional[str] = None


class NotificationListData(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread: int
    page: int
    page_size: int


class NotificationSummaryData(BaseModel):
    total: int
    unread: int


class NotificationGenerateData(BaseModel):
    created: int
    skipped: int


class NotificationApiResponse(BaseModel):
    success: bool = True
    message: str
    data: NotificationResponse


class NotificationListResponse(BaseModel):
    success: bool = True
    message: str
    data: NotificationListData


class NotificationSummaryResponse(BaseModel):
    success: bool = True
    message: str
    data: NotificationSummaryData


class NotificationGenerateResponse(BaseModel):
    success: bool = True
    message: str
    data: NotificationGenerateData


class NotificationMutateResponse(BaseModel):
    success: bool = True
    message: str
    data: dict = Field(default_factory=dict)
