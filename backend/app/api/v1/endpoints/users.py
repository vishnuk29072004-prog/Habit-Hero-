from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import MessageResponse
from app.schemas.user import (
    PasswordChange,
    ProfileApiResponse,
    ProfileUpdate,
    SettingsApiResponse,
    UserSettingsUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=ProfileApiResponse)
def get_my_profile(current_user: CurrentUser) -> ProfileApiResponse:
    return ProfileApiResponse(
        success=True,
        message="Profile retrieved successfully",
        data=user_service.get_profile(current_user),
    )


@router.patch("/me", response_model=ProfileApiResponse)
def update_my_profile(
    payload: ProfileUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> ProfileApiResponse:
    user = user_service.update_profile(db, current_user, payload)
    return ProfileApiResponse(
        success=True,
        message="Profile updated successfully",
        data=user_service.to_profile_response(user),
    )


@router.post("/me/avatar", response_model=ProfileApiResponse)
async def upload_my_avatar(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(..., description="JPEG, PNG, or WebP image (max 2 MB)"),
) -> ProfileApiResponse:
    user = await user_service.save_avatar(db, current_user, file)
    return ProfileApiResponse(
        success=True,
        message="Avatar uploaded successfully",
        data=user_service.to_profile_response(user),
    )


@router.delete("/me/avatar", response_model=ProfileApiResponse)
def delete_my_avatar(
    current_user: CurrentUser,
    db: DbSession,
) -> ProfileApiResponse:
    user = user_service.delete_avatar(db, current_user)
    return ProfileApiResponse(
        success=True,
        message="Avatar removed successfully",
        data=user_service.to_profile_response(user),
    )


@router.patch("/me/password", response_model=MessageResponse)
def change_my_password(
    payload: PasswordChange,
    current_user: CurrentUser,
    db: DbSession,
) -> MessageResponse:
    user_service.change_password(db, current_user, payload)
    return MessageResponse(
        success=True,
        message=(
            "Password changed successfully. Refresh tokens have been revoked. "
            "Existing access tokens remain valid until they expire."
        ),
    )


@router.get("/me/settings", response_model=SettingsApiResponse)
def get_my_settings(
    current_user: CurrentUser,
    db: DbSession,
) -> SettingsApiResponse:
    return SettingsApiResponse(
        success=True,
        message="Settings retrieved successfully",
        data=user_service.get_settings_for_user(db, current_user),
    )


@router.patch("/me/settings", response_model=SettingsApiResponse)
def update_my_settings(
    payload: UserSettingsUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> SettingsApiResponse:
    data = user_service.update_settings(db, current_user, payload)
    return SettingsApiResponse(
        success=True,
        message="Settings updated successfully",
        data=data,
    )
