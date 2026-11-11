from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def validate_password_strength(value: str) -> str:
    if value.strip() != value or not value.strip():
        raise ValueError("Password must not be empty or whitespace-only")
    checks = [
        (any(c.isupper() for c in value), "an uppercase letter"),
        (any(c.islower() for c in value), "a lowercase letter"),
        (any(c.isdigit() for c in value), "a digit"),
        (any(not c.isalnum() for c in value), "a special character"),
    ]
    missing = [label for ok, label in checks if not ok]
    if missing:
        if len(missing) == 1:
            raise ValueError(f"Password must contain {missing[0]}")
        raise ValueError(
            "Password must contain "
            + ", ".join(missing[:-1])
            + f", and {missing[-1]}"
        )
    return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: EmailStr


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: EmailStr
    avatar_url: Optional[str] = None
    created_at: str


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Full name is required")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: Optional[EmailStr]) -> Optional[str]:
        if value is None:
            return value
        return str(value).strip().lower()


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password_strength(value)


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    streak_goal_target: int
    notifications_enabled: bool
    remind_habits_daily: bool
    remind_habits_weekly: bool
    remind_habits_upcoming: bool
    remind_habits_overdue: bool
    remind_goal_deadlines: bool
    remind_streak_milestones: bool
    remind_weekly_summary: bool
    updated_at: str


class UserSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    streak_goal_target: Optional[int] = Field(default=None, ge=1, le=365)
    notifications_enabled: Optional[bool] = None
    remind_habits_daily: Optional[bool] = None
    remind_habits_weekly: Optional[bool] = None
    remind_habits_upcoming: Optional[bool] = None
    remind_habits_overdue: Optional[bool] = None
    remind_goal_deadlines: Optional[bool] = None
    remind_streak_milestones: Optional[bool] = None
    remind_weekly_summary: Optional[bool] = None


class ProfileApiResponse(BaseModel):
    success: bool = True
    message: str
    data: ProfileResponse


class SettingsApiResponse(BaseModel):
    success: bool = True
    message: str
    data: UserSettingsResponse


class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Full name is required")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password_strength(value)
