from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.achievement import UserAchievement
    from app.models.day_note import DayNote
    from app.models.goal import Goal
    from app.models.habit import Habit
    from app.models.journal import JournalEntry
    from app.models.notification import Notification
    from app.models.refresh_token import RefreshToken


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    avatar_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    settings: Mapped[Optional["UserSettings"]] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    habits: Mapped[List["Habit"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    goals: Mapped[List["Goal"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    day_notes: Mapped[List["DayNote"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    journal_entries: Mapped[List["JournalEntry"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    achievements: Mapped[List["UserAchievement"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    streak_goal_target: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=15,
        server_default="15",
    )
    notifications_enabled: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_habits_daily: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_habits_weekly: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_habits_upcoming: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_habits_overdue: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_goal_deadlines: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_streak_milestones: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    remind_weekly_summary: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="settings")
