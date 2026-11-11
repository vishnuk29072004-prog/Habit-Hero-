"""User profile, avatar, password, and settings business logic."""

from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserSettings
from app.schemas.user import (
    PasswordChange,
    ProfileResponse,
    ProfileUpdate,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.services import auth_service

ALLOWED_IMAGE_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def avatar_url_from_path(avatar_path: Optional[str]) -> Optional[str]:
    if not avatar_path:
        return None
    prefix = settings.uploads_url_prefix.rstrip("/")
    return f"{prefix}/{avatar_path.replace(chr(92), '/')}"


def to_profile_response(user: User) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        avatar_url=avatar_url_from_path(user.avatar_path),
        created_at=user.created_at,
    )


def get_profile(user: User) -> ProfileResponse:
    return to_profile_response(user)


def update_profile(db: Session, user: User, payload: ProfileUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile fields provided",
        )

    if "email" in data:
        email = auth_service.normalize_email(data["email"])
        existing = auth_service.get_user_by_email(db, email)
        if existing is not None and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        user.email = email

    if "full_name" in data:
        user.full_name = data["full_name"]

    user.updated_at = _utcnow_iso()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _ensure_avatars_root() -> Path:
    root = settings.avatars_path
    root.mkdir(parents=True, exist_ok=True)
    return root


def _user_avatar_dir(user_id: str) -> Path:
    # UUID user ids are safe; still refuse path separators.
    if "/" in user_id or "\\" in user_id or ".." in user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id",
        )
    path = _ensure_avatars_root() / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _resolve_managed_avatar(avatar_path: Optional[str]) -> Optional[Path]:
    if not avatar_path:
        return None
    candidate = (settings.uploads_path / avatar_path).resolve()
    uploads_root = settings.uploads_path.resolve()
    try:
        candidate.relative_to(uploads_root)
    except ValueError:
        return None
    if not candidate.is_file():
        return None
    return candidate


def _delete_managed_avatar(avatar_path: Optional[str]) -> None:
    path = _resolve_managed_avatar(avatar_path)
    if path is None:
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def _validate_and_reencode_image(raw: bytes) -> tuple[bytes, str, str]:
    """Validate image bytes and re-encode. Returns (bytes, format, extension)."""
    if len(raw) > settings.max_avatar_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum size of {settings.max_avatar_bytes} bytes",
        )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty image file",
        )

    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            fmt = (image.format or "").upper()
            if fmt not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported image type. Use JPEG, PNG, or WebP",
                )
            # Re-encode to strip metadata and normalize pixel data.
            if fmt == "JPEG":
                working = image.convert("RGB")
            else:
                working = (
                    image.convert("RGBA")
                    if "A" in image.getbands()
                    else image.convert("RGB")
                )
            buffer = io.BytesIO()
            save_kwargs: dict = {"format": fmt}
            if fmt == "JPEG":
                save_kwargs.update(quality=90, optimize=True)
            elif fmt == "PNG":
                save_kwargs.update(optimize=True)
            elif fmt == "WEBP":
                save_kwargs.update(quality=90, method=6)
            working.save(buffer, **save_kwargs)
            encoded = buffer.getvalue()
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed image content",
        ) from exc
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed image content",
        ) from exc

    if len(encoded) > settings.max_avatar_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum size of {settings.max_avatar_bytes} bytes",
        )

    return encoded, fmt, ALLOWED_IMAGE_FORMATS[fmt]


async def save_avatar(db: Session, user: User, upload: UploadFile) -> User:
    raw = await upload.read(settings.max_avatar_bytes + 1)
    if len(raw) > settings.max_avatar_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum size of {settings.max_avatar_bytes} bytes",
        )

    encoded, _fmt, extension = _validate_and_reencode_image(raw)
    user_dir = _user_avatar_dir(user.id)
    filename = f"{uuid.uuid4().hex}{extension}"
    absolute = user_dir / filename
    absolute.write_bytes(encoded)

    relative = f"{settings.avatar_subdir}/{user.id}/{filename}"
    previous = user.avatar_path
    user.avatar_path = relative
    user.updated_at = _utcnow_iso()
    db.add(user)
    db.commit()
    db.refresh(user)

    if previous and previous != relative:
        _delete_managed_avatar(previous)
    return user


def delete_avatar(db: Session, user: User) -> User:
    previous = user.avatar_path
    if previous is None:
        return user
    user.avatar_path = None
    user.updated_at = _utcnow_iso()
    db.add(user)
    db.commit()
    db.refresh(user)
    _delete_managed_avatar(previous)
    return user


def revoke_all_refresh_tokens(db: Session, user_id: str) -> None:
    now = _utcnow_iso()
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    db.commit()


def change_password(db: Session, user: User, payload: PasswordChange) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = _utcnow_iso()
    db.add(user)
    db.commit()
    revoke_all_refresh_tokens(db, user.id)


_PREF_BOOL_FIELDS = (
    "notifications_enabled",
    "remind_habits_daily",
    "remind_habits_weekly",
    "remind_habits_upcoming",
    "remind_habits_overdue",
    "remind_goal_deadlines",
    "remind_streak_milestones",
    "remind_weekly_summary",
)


def _settings_response(row: UserSettings) -> UserSettingsResponse:
    return UserSettingsResponse(
        streak_goal_target=row.streak_goal_target,
        notifications_enabled=bool(row.notifications_enabled),
        remind_habits_daily=bool(row.remind_habits_daily),
        remind_habits_weekly=bool(row.remind_habits_weekly),
        remind_habits_upcoming=bool(row.remind_habits_upcoming),
        remind_habits_overdue=bool(row.remind_habits_overdue),
        remind_goal_deadlines=bool(row.remind_goal_deadlines),
        remind_streak_milestones=bool(row.remind_streak_milestones),
        remind_weekly_summary=bool(row.remind_weekly_summary),
        updated_at=row.updated_at,
    )


def get_or_create_settings(db: Session, user: User) -> UserSettings:
    row = db.get(UserSettings, user.id)
    if row is not None:
        return row
    row = UserSettings(
        user_id=user.id,
        streak_goal_target=15,
        notifications_enabled=1,
        remind_habits_daily=1,
        remind_habits_weekly=1,
        remind_habits_upcoming=1,
        remind_habits_overdue=1,
        remind_goal_deadlines=1,
        remind_streak_milestones=1,
        remind_weekly_summary=1,
        updated_at=_utcnow_iso(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_settings_for_user(db: Session, user: User) -> UserSettingsResponse:
    row = get_or_create_settings(db, user)
    return _settings_response(row)


def update_settings(
    db: Session, user: User, payload: UserSettingsUpdate
) -> UserSettingsResponse:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No settings fields provided",
        )
    row = get_or_create_settings(db, user)
    if "streak_goal_target" in data:
        row.streak_goal_target = data["streak_goal_target"]
    for field in _PREF_BOOL_FIELDS:
        if field in data:
            setattr(row, field, 1 if data[field] else 0)
    row.updated_at = _utcnow_iso()
    db.add(row)
    db.commit()
    db.refresh(row)
    return _settings_response(row)
