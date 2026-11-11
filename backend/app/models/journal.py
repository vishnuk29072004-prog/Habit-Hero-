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
    from app.models.habit import Habit
    from app.models.user import User


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        CheckConstraint(
            "mood IN ("
            "'happy', 'productive', 'motivated', 'neutral', "
            "'tired', 'stressed', 'sad'"
            ")",
            name="ck_journal_entries_mood",
        ),
        Index("ix_journal_entries_user_date", "user_id", "date"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[str] = mapped_column(Text, nullable=False)
    habit_id: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("habits.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    mood: Mapped[str] = mapped_column(String, nullable=False, default="neutral")
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="journal_entries")
    habit: Mapped[Optional["Habit"]] = relationship(back_populates="journal_entries")
    tags: Mapped[List["JournalEntryTag"]] = relationship(
        back_populates="journal_entry",
        cascade="all, delete-orphan",
    )


class JournalEntryTag(Base):
    __tablename__ = "journal_entry_tags"
    __table_args__ = (
        UniqueConstraint(
            "journal_entry_id",
            "tag",
            name="uq_journal_entry_tags",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tag: Mapped[str] = mapped_column(Text, nullable=False)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="tags")
