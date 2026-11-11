"""Password hashing and JWT helpers."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except (ValueError, TypeError):
        return False


def hash_token(raw_token: str) -> str:
    """SHA-256 hash for storing refresh tokens (never store raw tokens)."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_token_jti() -> str:
    return secrets.token_urlsafe(32)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    *,
    subject: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    expire = _utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": TOKEN_TYPE_ACCESS,
        "exp": expire,
        "iat": _utcnow(),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(
    *,
    subject: str,
    jti: str,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, datetime]:
    expire = _utcnow() + (
        expires_delta
        if expires_delta is not None
        else timedelta(days=settings.refresh_token_expire_days)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "type": TOKEN_TYPE_REFRESH,
        "jti": jti,
        "exp": expire,
        "iat": _utcnow(),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, expire


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT. Raises JWTError on failure."""
    return jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
        options={"require_exp": True, "require_sub": True},
    )


def safe_decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return decode_token(token)
    except JWTError:
        return None
