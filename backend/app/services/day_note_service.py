"""Day note CRUD (one note per user per date)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.day_note import DayNote
from app.models.user import User
from app.schemas.calendar import DayNoteCreate, DayNoteUpdate
from app.utils.date_keys import parse_date_key


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def list_notes(
    db: Session,
    user: User,
    *,
    date_key: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[DayNote]:
    filters = [DayNote.user_id == user.id]
    if date_key:
        try:
            date_key = parse_date_key(date_key).isoformat()
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Date must be YYYY-MM-DD",
            ) from exc
        filters.append(DayNote.date == date_key)
    if start_date:
        filters.append(DayNote.date >= start_date)
    if end_date:
        filters.append(DayNote.date <= end_date)
    return list(
        db.scalars(
            select(DayNote).where(*filters).order_by(DayNote.date.desc())
        ).all()
    )


def create_note(db: Session, user: User, payload: DayNoteCreate) -> DayNote:
    existing = db.scalar(
        select(DayNote).where(
            DayNote.user_id == user.id,
            DayNote.date == payload.date,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A day note already exists for this date",
        )
    row = DayNote(
        user_id=user.id,
        date=payload.date,
        notes=payload.notes,
        updated_at=_utcnow_iso(),
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A day note already exists for this date",
        ) from exc
    db.refresh(row)
    return row


def get_owned_note(db: Session, user: User, note_id: int) -> DayNote:
    row = db.scalar(
        select(DayNote).where(DayNote.id == note_id, DayNote.user_id == user.id)
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Day note not found",
        )
    return row


def update_note(
    db: Session, user: User, note_id: int, payload: DayNoteUpdate
) -> DayNote:
    row = get_owned_note(db, user, note_id)
    row.notes = payload.notes
    row.updated_at = _utcnow_iso()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_note(db: Session, user: User, note_id: int) -> int:
    row = get_owned_note(db, user, note_id)
    deleted_id = row.id
    db.delete(row)
    db.commit()
    return deleted_id
