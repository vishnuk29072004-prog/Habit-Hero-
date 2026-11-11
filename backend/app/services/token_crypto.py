"""Fernet helpers for encrypting OAuth tokens at rest."""

from __future__ import annotations

from fastapi import HTTPException, status
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import Settings, get_settings


class TokenEncryptionError(RuntimeError):
    pass


def _fernet(app_settings: Settings | None = None) -> Fernet:
    cfg = app_settings or get_settings()
    key = (cfg.token_encryption_key or "").strip()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Token encryption is not configured. Set TOKEN_ENCRYPTION_KEY "
                "on the server (Fernet key)."
            ),
        )
    try:
        return Fernet(key.encode("utf-8") if isinstance(key, str) else key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TOKEN_ENCRYPTION_KEY is invalid. Generate a Fernet key.",
        ) from exc


def encrypt_token(plain: str, *, app_settings: Settings | None = None) -> str:
    if plain is None:
        raise TokenEncryptionError("token required")
    return _fernet(app_settings).encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_token(cipher: str, *, app_settings: Settings | None = None) -> str:
    if not cipher:
        raise TokenEncryptionError("cipher required")
    try:
        return _fernet(app_settings).decrypt(cipher.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise TokenEncryptionError("unable to decrypt token") from exc
