from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import (
    AuthResponse,
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    TokenPair,
    TokenResponse,
    UserLogin,
)
from app.schemas.user import UserRegister, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: UserRegister, db: DbSession) -> AuthResponse:
    user = auth_service.register_user(db, payload)
    return AuthResponse(
        success=True,
        message="Account created successfully",
        data=auth_service.user_to_response(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: DbSession) -> TokenResponse:
    data = auth_service.login_user(db, payload)
    return TokenResponse(
        success=True,
        message="Login successful",
        data=TokenPair(**data),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest, db: DbSession) -> TokenResponse:
    data = auth_service.refresh_access_token(db, payload.refresh_token)
    return TokenResponse(
        success=True,
        message="Token refreshed successfully",
        data=TokenPair(**data),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(payload: LogoutRequest, db: DbSession) -> MessageResponse:
    auth_service.logout_user(db, payload.refresh_token)
    return MessageResponse(success=True, message="Logged out successfully")


@router.get("/me", response_model=AuthResponse)
def me(current_user: CurrentUser) -> AuthResponse:
    return AuthResponse(
        success=True,
        message="Current user retrieved successfully",
        data=UserResponse.model_validate(current_user),
    )
