"""Google Calendar OAuth connection and habit↔event mapping."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.habit import Habit
    from app.models.user import User


class GoogleCalendarConnection(Base):
    __tablename__ = "google_calendar_connections"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_google_calendar_connections_user"),
        Index("ix_google_calendar_connections_user", "user_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    google_account_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    google_account_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Fernet ciphertext — never return in API responses.
    access_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    calendar_id: Mapped[str] = mapped_column(String, nullable=False, default="primary")
    last_sync_at: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_sync_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship()


class HabitGoogleEvent(Base):
    __tablename__ = "habit_google_events"
    __table_args__ = (
        UniqueConstraint("habit_id", name="uq_habit_google_events_habit"),
        UniqueConstraint(
            "user_id", "google_event_id", name="uq_habit_google_events_user_event"
        ),
        Index("ix_habit_google_events_user", "user_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    habit_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
    )
    google_event_id: Mapped[str] = mapped_column(String, nullable=False)
    calendar_id: Mapped[str] = mapped_column(String, nullable=False, default="primary")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    habit: Mapped["Habit"] = relationship()
