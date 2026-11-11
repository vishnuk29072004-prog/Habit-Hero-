from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.date_keys import parse_date_key

CheckinStatus = Literal["completed", "incomplete"]


def _validate_date_key(value: str) -> str:
    try:
        return parse_date_key(value).isoformat()
    except ValueError as exc:
        raise ValueError("Date must be YYYY-MM-DD") from exc


class CheckinCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str
    status: CheckinStatus = "completed"
    notes: str = Field(default="", max_length=5000)

    @field_validator("date")
    @classmethod
    def valid_date(cls, value: str) -> str:
        return _validate_date_key(value)

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class CheckinUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[CheckinStatus] = None
    notes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("notes")
    @classmethod
    def strip_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()


class CheckinResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: str
    date: str
    status: CheckinStatus
    notes: str
    updated_at: str


class CheckinListData(BaseModel):
    items: List[CheckinResponse]
    total: int
    page: int
    page_size: int


class CheckinApiResponse(BaseModel):
    success: bool = True
    message: str
    data: CheckinResponse


class CheckinListResponse(BaseModel):
    success: bool = True
    message: str
    data: CheckinListData


class CheckinDeleteResponse(BaseModel):
    success: bool = True
    message: str
    data: dict
