from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.habit import Habit
    from app.models.user import User


class Goal(Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint(
            "target_type IN ("
            "'completion_count', 'consecutive_days', "
            "'days_completed', 'completion_percentage'"
            ")",
            name="ck_goals_target_type",
        ),
        CheckConstraint("target_value >= 1", name="ck_goals_target_value"),
        CheckConstraint("archived IN (0, 1)", name="ck_goals_archived"),
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
    category: Mapped[str] = mapped_column(String, nullable=False, default="Health")
    icon: Mapped[str] = mapped_column(String, nullable=False, default="")
    linked_habit_id: Mapped[Optional[str]] = mapped_column(
        String,
        ForeignKey("habits.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    target_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="completion_count",
    )
    target_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    start_date: Mapped[str] = mapped_column(Text, nullable=False)
    end_date: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(back_populates="goals")
    linked_habit: Mapped[Optional["Habit"]] = relationship(back_populates="goals")
