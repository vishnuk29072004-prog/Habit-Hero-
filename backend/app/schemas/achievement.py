"""Achievement schemas (user_achievements + catalogue)."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AchievementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    achievement_id: str
    title: str
    body: str
    icon: str
    unlocked_at: str


class AchievementCatalogueItem(BaseModel):
    achievement_id: str
    title: str
    body: str
    icon: str
    earned: bool
    unlocked_at: Optional[str] = None


class AchievementSummaryData(BaseModel):
    total_earned: int
    total_available: int
    recent: List[AchievementResponse]
    catalogue: List[AchievementCatalogueItem]


class AchievementApiResponse(BaseModel):
    success: bool = True
    message: str
    data: AchievementResponse


class AchievementListResponse(BaseModel):
    success: bool = True
    message: str
    data: List[AchievementResponse]


class AchievementSummaryResponse(BaseModel):
    success: bool = True
    message: str
    data: AchievementSummaryData
