from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserResponse


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def password_not_blank(cls, value: str) -> str:
        if not value:
            raise ValueError("Password is required")
        return value


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenResponse(BaseModel):
    success: bool = True
    message: str
    data: TokenPair


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)

    @field_validator("refresh_token")
    @classmethod
    def token_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Refresh token is required")
        return cleaned


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)

    @field_validator("refresh_token")
    @classmethod
    def token_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Refresh token is required")
        return cleaned


class AuthResponse(BaseModel):
    success: bool = True
    message: str
    data: UserResponse | None = None


class MessageResponse(BaseModel):
    success: bool = True
    message: str
