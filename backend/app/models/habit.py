from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.goal import Goal
    from app.models.journal import JournalEntry
    from app.models.user import User


class Habit(Base):
    __tablename__ = "habits"
    __table_args__ = (
        CheckConstraint(
            "frequency IN ('Daily', 'Weekly')",
            name="ck_habits_frequency",
        ),
        CheckConstraint(
            "archived IN (0, 1)",
            name="ck_habits_archived",
        ),
        CheckConstraint(
            "week_day IS NULL OR (week_day >= 0 AND week_day <= 6)",
            name="ck_habits_week_day",
        ),
        Index("ix_habits_user_archived", "user_id", "archived"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    icon: Mapped[str] = mapped_column(String, nullable=False, default="sparkles")
    category: Mapped[str] = mapped_column(String, nullable=False, default="Health")
    frequency: Mapped[str] = mapped_column(String, nullable=False, default="Daily")
    start_date: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    week_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="habits")
    checkins: Mapped[List["HabitCheckin"]] = relationship(
        back_populates="habit",
        cascade="all, delete-orphan",
    )
    goals: Mapped[List["Goal"]] = relationship(back_populates="linked_habit")
    journal_entries: Mapped[List["JournalEntry"]] = relationship(
        back_populates="habit"
    )


class HabitCheckin(Base):
    __tablename__ = "habit_checkins"
    __table_args__ = (
        UniqueConstraint("habit_id", "date", name="uq_habit_checkins_habit_date"),
        CheckConstraint(
            "completed IN (0, 1)",
            name="ck_habit_checkins_completed",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    habit_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    habit: Mapped["Habit"] = relationship(back_populates="checkins")
