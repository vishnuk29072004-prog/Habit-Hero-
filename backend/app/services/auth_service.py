"""Authentication business logic."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    TOKEN_TYPE_ACCESS,
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    create_token_jti,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserSettings
from app.schemas.auth import UserLogin
from app.schemas.user import UserRegister, UserResponse


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def normalize_email(email: str) -> str:
    return email.strip().lower()


def user_to_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, full_name=user.full_name, email=user.email)


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.get(User, user_id)


def register_user(db: Session, payload: UserRegister) -> User:
    email = normalize_email(payload.email)
    if get_user_by_email(db, email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    now = _utcnow_iso()
    user = User(
        id=str(uuid.uuid4()),
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        avatar_path=None,
        created_at=now,
        updated_at=now,
    )
    settings_row = UserSettings(
        user_id=user.id,
        streak_goal_target=15,
        updated_at=now,
    )
    db.add(user)
    db.add(settings_row)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, payload: UserLogin) -> User:
    user = get_user_by_email(db, payload.email)
    # Constant-ish failure message — do not reveal whether email exists.
    invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid
    return user


def _store_refresh_token(
    db: Session,
    *,
    user_id: str,
    raw_token: str,
    expires_at: datetime,
) -> RefreshToken:
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=expires_at.replace(microsecond=0).isoformat(),
        revoked_at=None,
        created_at=_utcnow_iso(),
    )
    db.add(row)
    db.flush()
    return row


def issue_token_pair(db: Session, user: User) -> dict:
    access_token = create_access_token(subject=user.id)
    jti = create_token_jti()
    refresh_token, expires_at = create_refresh_token(subject=user.id, jti=jti)
    _store_refresh_token(
        db,
        user_id=user.id,
        raw_token=refresh_token,
        expires_at=expires_at,
    )
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_to_response(user),
    }


def login_user(db: Session, payload: UserLogin) -> dict:
    user = authenticate_user(db, payload)
    return issue_token_pair(db, user)


def _get_refresh_row(db: Session, raw_token: str) -> Optional[RefreshToken]:
    return db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    )


def _unauthorized(detail: str = "Invalid or expired refresh token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def refresh_access_token(db: Session, raw_refresh_token: str) -> dict:
    try:
        payload = decode_token(raw_refresh_token)
    except JWTError as exc:
        raise _unauthorized() from exc

    if payload.get("type") != TOKEN_TYPE_REFRESH:
        raise _unauthorized()

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise _unauthorized()

    row = _get_refresh_row(db, raw_refresh_token)
    if row is None:
        raise _unauthorized()

    if row.revoked_at is not None:
        raise _unauthorized("Refresh token has been revoked")

    if _parse_iso(row.expires_at) <= datetime.now(timezone.utc):
        raise _unauthorized("Refresh token has expired")

    if row.user_id != user_id:
        raise _unauthorized()

    user = get_user_by_id(db, user_id)
    if user is None:
        raise _unauthorized("User not found")

    # Rotate: revoke previous token, issue a new pair.
    row.revoked_at = _utcnow_iso()
    db.add(row)
    db.flush()

    return issue_token_pair(db, user)


def logout_user(db: Session, raw_refresh_token: str) -> None:
    """Revoke a refresh token. Idempotent if already revoked or unknown."""
    try:
        payload = decode_token(raw_refresh_token)
    except JWTError:
        # Idempotent logout for garbage tokens — treat as success.
        return

    if payload.get("type") != TOKEN_TYPE_REFRESH:
        return

    row = _get_refresh_row(db, raw_refresh_token)
    if row is None:
        return

    if row.revoked_at is None:
        row.revoked_at = _utcnow_iso()
        db.add(row)
        db.commit()


def resolve_user_from_access_token(db: Session, token: str) -> User:
    try:
        payload = decode_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def create_expired_access_token_for_tests(user_id: str) -> str:
    """Helper for tests — short-circuits via negative expiry."""
    return create_access_token(
        subject=user_id,
        expires_delta=timedelta(seconds=-60),
    )


def create_expired_refresh_token_for_tests(
    db: Session, user: User
) -> str:
    jti = create_token_jti()
    token, expires_at = create_refresh_token(
        subject=user.id,
        jti=jti,
        expires_delta=timedelta(seconds=-60),
    )
    _store_refresh_token(
        db,
        user_id=user.id,
        raw_token=token,
        expires_at=expires_at,
    )
    db.commit()
    return token
