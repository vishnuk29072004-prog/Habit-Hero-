"""Google Calendar OAuth + habit event synchronization."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.google_calendar import GoogleCalendarConnection, HabitGoogleEvent
from app.models.habit import Habit
from app.models.user import User
from app.services import token_crypto
from app.utils.date_keys import today_key

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
SCOPES = (
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _utcnow_iso() -> str:
    return _utcnow().isoformat().replace("+00:00", "Z")


def require_google_config(app_settings: Optional[Settings] = None) -> Settings:
    cfg = app_settings or get_settings()
    if not cfg.google_calendar_configured:
        missing = cfg.google_calendar_missing_fields()
        missing_txt = ", ".join(missing) if missing else "required Google env vars"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google Calendar is not configured on the server. "
                f"Missing or empty: {missing_txt}."
            ),
        )
    return cfg


def _sign_state(payload: dict[str, Any], secret: str) -> str:
    import base64

    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    sig = hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()
    blob = json.dumps({"p": payload, "s": sig}, separators=(",", ":"))
    return base64.urlsafe_b64encode(blob.encode("utf-8")).decode("utf-8").rstrip("=")


def _verify_state(state: str, secret: str) -> dict[str, Any]:
    import base64

    try:
        pad = "=" * (-len(state) % 4)
        raw = base64.urlsafe_b64decode(state + pad).decode("utf-8")
        envelope = json.loads(raw)
        payload = envelope["p"]
        sig = envelope["s"]
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state.",
        ) from exc
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    expected = hmac.new(
        secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state signature.",
        )
    exp = int(payload.get("exp") or 0)
    if exp < int(_utcnow().timestamp()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state expired. Please connect again.",
        )
    return payload


def build_connect_url(user: User, *, app_settings: Optional[Settings] = None) -> dict:
    cfg = require_google_config(app_settings)
    state = _sign_state(
        {
            "uid": user.id,
            "nonce": secrets.token_urlsafe(16),
            "exp": int((_utcnow() + timedelta(minutes=10)).timestamp()),
        },
        cfg.secret_key,
    )
    params = {
        "client_id": cfg.google_client_id,
        "redirect_uri": cfg.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return {"authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}", "state": state}


def _token_expiry_iso(expires_in: Any) -> Optional[str]:
    try:
        seconds = int(expires_in)
    except (TypeError, ValueError):
        return None
    return (_utcnow() + timedelta(seconds=max(seconds - 30, 0))).isoformat().replace(
        "+00:00", "Z"
    )


def exchange_code(
    db: Session,
    *,
    code: str,
    state: str,
    app_settings: Optional[Settings] = None,
    http_client: Any = None,
) -> dict:
    cfg = require_google_config(app_settings)
    payload = _verify_state(state, cfg.secret_key)
    user_id = payload.get("uid")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid OAuth state payload.")

    client = http_client or httpx.Client(timeout=30.0)
    close = http_client is None
    try:
        token_res = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": cfg.google_client_id,
                "client_secret": cfg.google_client_secret,
                "redirect_uri": cfg.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google authorization failed. Please try connecting again.",
            )
        tokens = token_res.json()
        access = tokens.get("access_token")
        if not access:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google did not return an access token.",
            )
        refresh = tokens.get("refresh_token")
        info_res = client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access}"},
        )
        email = None
        account_id = None
        if info_res.status_code < 400:
            info = info_res.json()
            email = info.get("email")
            account_id = info.get("id")
    finally:
        if close:
            client.close()

    now = _utcnow_iso()
    row = db.scalar(
        select(GoogleCalendarConnection).where(
            GoogleCalendarConnection.user_id == user_id
        )
    )
    if row is None:
        row = GoogleCalendarConnection(
            id=str(uuid.uuid4()),
            user_id=user_id,
            created_at=now,
            access_token_enc="",
        )
        db.add(row)

    row.access_token_enc = token_crypto.encrypt_token(access, app_settings=cfg)
    if refresh:
        row.refresh_token_enc = token_crypto.encrypt_token(refresh, app_settings=cfg)
    elif not row.refresh_token_enc:
        # Re-consent may be required later if refresh missing.
        row.refresh_token_enc = None
    row.token_expiry = _token_expiry_iso(tokens.get("expires_in"))
    row.scopes = tokens.get("scope") or " ".join(SCOPES)
    row.google_account_email = email
    row.google_account_id = account_id
    row.calendar_id = row.calendar_id or "primary"
    row.updated_at = now
    db.commit()
    db.refresh(row)
    return {
        "user_id": user_id,
        "email": email,
        "frontend_redirect": f"{cfg.frontend_app_url.rstrip('/')}/settings?google=connected",
    }


def get_connection(db: Session, user: User) -> Optional[GoogleCalendarConnection]:
    return db.scalar(
        select(GoogleCalendarConnection).where(
            GoogleCalendarConnection.user_id == user.id
        )
    )


def connection_status(db: Session, user: User) -> dict:
    cfg = get_settings()
    row = get_connection(db, user)
    missing = cfg.google_calendar_missing_fields()
    # Never include secret values — names of missing env vars only.
    return {
        "configured": cfg.google_calendar_configured,
        "missing_config": missing,
        "redirect_uri_configured": bool(cfg.google_redirect_uri),
        "connected": row is not None,
        "email": row.google_account_email if row else None,
        "calendar_id": row.calendar_id if row else None,
        "last_sync_at": row.last_sync_at if row else None,
        "last_sync_status": row.last_sync_status if row else None,
        "connected_at": row.created_at if row else None,
    }


def disconnect(db: Session, user: User) -> dict:
    row = get_connection(db, user)
    if row is None:
        return {"disconnected": True, "message": "No Google Calendar connection."}
    mappings = list(
        db.scalars(
            select(HabitGoogleEvent).where(HabitGoogleEvent.user_id == user.id)
        ).all()
    )
    # Best-effort remote delete; local cleanup always proceeds.
    try:
        access = _ensure_access_token(db, row)
        client = httpx.Client(timeout=20.0)
        try:
            for m in mappings:
                url = GOOGLE_EVENTS_URL.format(calendar_id=m.calendar_id) + f"/{m.google_event_id}"
                client.delete(url, headers={"Authorization": f"Bearer {access}"})
        finally:
            client.close()
    except Exception:
        pass
    for m in mappings:
        db.delete(m)
    db.delete(row)
    db.commit()
    return {"disconnected": True, "message": "Google Calendar disconnected."}


def _ensure_access_token(
    db: Session,
    row: GoogleCalendarConnection,
    *,
    app_settings: Optional[Settings] = None,
    http_client: Any = None,
) -> str:
    cfg = require_google_config(app_settings)
    access = token_crypto.decrypt_token(row.access_token_enc, app_settings=cfg)
    expiry = row.token_expiry
    needs_refresh = True
    if expiry:
        try:
            exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            needs_refresh = exp_dt <= _utcnow()
        except ValueError:
            needs_refresh = True
    if not needs_refresh:
        return access
    if not row.refresh_token_enc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authorization expired. Please reconnect Google Calendar.",
        )
    refresh = token_crypto.decrypt_token(row.refresh_token_enc, app_settings=cfg)
    client = http_client or httpx.Client(timeout=30.0)
    close = http_client is None
    try:
        res = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": cfg.google_client_id,
                "client_secret": cfg.google_client_secret,
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
        )
        if res.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google authorization was revoked. Please reconnect.",
            )
        data = res.json()
        access = data.get("access_token")
        if not access:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google token refresh failed.",
            )
        row.access_token_enc = token_crypto.encrypt_token(access, app_settings=cfg)
        if data.get("refresh_token"):
            row.refresh_token_enc = token_crypto.encrypt_token(
                data["refresh_token"], app_settings=cfg
            )
        row.token_expiry = _token_expiry_iso(data.get("expires_in"))
        row.updated_at = _utcnow_iso()
        db.commit()
        return access
    finally:
        if close:
            client.close()


def _rrule_for_habit(habit: Habit) -> Optional[str]:
    if habit.frequency == "Daily":
        return "RRULE:FREQ=DAILY"
    if habit.frequency == "Weekly":
        # Google: SU MO TU WE TH FR SA ; Habit Hero week_day: 0=Sun … 6=Sat
        labels = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
        day = habit.week_day if habit.week_day is not None else 1
        day = max(0, min(6, int(day)))
        return f"RRULE:FREQ=WEEKLY;BYDAY={labels[day]}"
    return None


def _event_body_for_habit(habit: Habit) -> dict:
    start = habit.start_date or today_key()
    body: dict[str, Any] = {
        "summary": f"Habit Hero: {habit.name}",
        "description": (habit.description or habit.notes or "").strip()
        or f"Habit Hero habit ({habit.category}, {habit.frequency})",
        "start": {"date": start},
        "end": {"date": start},
    }
    rule = _rrule_for_habit(habit)
    if rule:
        body["recurrence"] = [rule]
    return body


def list_mapped_events(db: Session, user: User) -> list[dict]:
    rows = list(
        db.scalars(
            select(HabitGoogleEvent).where(HabitGoogleEvent.user_id == user.id)
        ).all()
    )
    return [
        {
            "id": r.id,
            "habit_id": r.habit_id,
            "google_event_id": r.google_event_id,
            "calendar_id": r.calendar_id,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


def sync_habits(
    db: Session,
    user: User,
    *,
    app_settings: Optional[Settings] = None,
    http_client: Any = None,
) -> dict:
    cfg = require_google_config(app_settings)
    row = get_connection(db, user)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Connect Google Calendar before syncing.",
        )
    access = _ensure_access_token(db, row, app_settings=cfg, http_client=http_client)
    habits = list(
        db.scalars(
            select(Habit).where(Habit.user_id == user.id, Habit.archived == 0)
        ).all()
    )
    mappings = {
        m.habit_id: m
        for m in db.scalars(
            select(HabitGoogleEvent).where(HabitGoogleEvent.user_id == user.id)
        ).all()
    }
    created = updated = deleted = 0
    errors: list[str] = []
    client = http_client or httpx.Client(timeout=45.0)
    close = http_client is None
    calendar_id = row.calendar_id or "primary"
    headers = {
        "Authorization": f"Bearer {access}",
        "Content-Type": "application/json",
    }
    try:
        active_ids = {h.id for h in habits}
        # Remove events for archived/deleted habits still mapped
        for habit_id, mapping in list(mappings.items()):
            if habit_id in active_ids:
                continue
            url = (
                GOOGLE_EVENTS_URL.format(calendar_id=mapping.calendar_id)
                + f"/{mapping.google_event_id}"
            )
            res = client.delete(url, headers=headers)
            if res.status_code in (200, 204, 404, 410):
                db.delete(mapping)
                deleted += 1
            else:
                errors.append(f"delete:{habit_id}")

        for habit in habits:
            body = _event_body_for_habit(habit)
            mapping = mappings.get(habit.id)
            if mapping is None:
                url = GOOGLE_EVENTS_URL.format(calendar_id=calendar_id)
                res = client.post(url, headers=headers, json=body)
                if res.status_code >= 400:
                    errors.append(f"create:{habit.name}")
                    continue
                event = res.json()
                event_id = event.get("id")
                if not event_id:
                    errors.append(f"create-id:{habit.name}")
                    continue
                now = _utcnow_iso()
                db.add(
                    HabitGoogleEvent(
                        id=str(uuid.uuid4()),
                        user_id=user.id,
                        habit_id=habit.id,
                        google_event_id=event_id,
                        calendar_id=calendar_id,
                        created_at=now,
                        updated_at=now,
                    )
                )
                created += 1
            else:
                url = (
                    GOOGLE_EVENTS_URL.format(calendar_id=mapping.calendar_id)
                    + f"/{mapping.google_event_id}"
                )
                res = client.patch(url, headers=headers, json=body)
                if res.status_code in (404, 410):
                    # Recreate if remote missing
                    create_url = GOOGLE_EVENTS_URL.format(calendar_id=calendar_id)
                    cres = client.post(create_url, headers=headers, json=body)
                    if cres.status_code >= 400:
                        errors.append(f"recreate:{habit.name}")
                        continue
                    event_id = cres.json().get("id")
                    mapping.google_event_id = event_id
                    mapping.calendar_id = calendar_id
                    mapping.updated_at = _utcnow_iso()
                    updated += 1
                elif res.status_code >= 400:
                    errors.append(f"update:{habit.name}")
                else:
                    mapping.updated_at = _utcnow_iso()
                    updated += 1

        row.last_sync_at = _utcnow_iso()
        row.last_sync_status = (
            "ok" if not errors else f"partial:{len(errors)} error(s)"
        )
        row.updated_at = _utcnow_iso()
        db.commit()
    finally:
        if close:
            client.close()

    return {
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "errors": errors,
        "last_sync_at": row.last_sync_at,
        "last_sync_status": row.last_sync_status,
    }


def delete_mapped_event(
    db: Session,
    user: User,
    event_id: str,
    *,
    app_settings: Optional[Settings] = None,
    http_client: Any = None,
) -> dict:
    mapping = db.scalar(
        select(HabitGoogleEvent).where(
            HabitGoogleEvent.user_id == user.id,
            HabitGoogleEvent.google_event_id == event_id,
        )
    )
    if mapping is None:
        raise HTTPException(status_code=404, detail="Mapped event not found.")
    row = get_connection(db, user)
    if row is None:
        db.delete(mapping)
        db.commit()
        return {"deleted": True}
    access = _ensure_access_token(db, row, app_settings=app_settings, http_client=http_client)
    client = http_client or httpx.Client(timeout=20.0)
    close = http_client is None
    try:
        url = (
            GOOGLE_EVENTS_URL.format(calendar_id=mapping.calendar_id)
            + f"/{mapping.google_event_id}"
        )
        client.delete(url, headers={"Authorization": f"Bearer {access}"})
    finally:
        if close:
            client.close()
    db.delete(mapping)
    db.commit()
    return {"deleted": True}


def cleanup_habit_event(db: Session, user: User, habit_id: str) -> None:
    """Best-effort remove Google event when a habit is archived/deleted."""
    mapping = db.scalar(
        select(HabitGoogleEvent).where(
            HabitGoogleEvent.user_id == user.id,
            HabitGoogleEvent.habit_id == habit_id,
        )
    )
    if mapping is None:
        return
    try:
        delete_mapped_event(db, user, mapping.google_event_id)
    except Exception:
        # Fall back to local unlink only.
        db.delete(mapping)
        db.commit()
