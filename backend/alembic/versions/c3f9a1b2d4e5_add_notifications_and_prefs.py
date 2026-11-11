"""add_notifications_and_prefs

Revision ID: c3f9a1b2d4e5
Revises: 2486eb757a7f
Create Date: 2026-11-11 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f9a1b2d4e5"
down_revision: Union[str, None] = "2486eb757a7f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PREF_COLUMNS = (
    "notifications_enabled",
    "remind_habits_daily",
    "remind_habits_weekly",
    "remind_habits_upcoming",
    "remind_habits_overdue",
    "remind_goal_deadlines",
    "remind_streak_milestones",
    "remind_weekly_summary",
)


def upgrade() -> None:
    with op.batch_alter_table("user_settings", schema=None) as batch_op:
        for name in _PREF_COLUMNS:
            batch_op.add_column(
                sa.Column(
                    name,
                    sa.Integer(),
                    server_default="1",
                    nullable=False,
                )
            )

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=True),
        sa.Column("resource_id", sa.String(), nullable=True),
        sa.Column("dedupe_key", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("read_at", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "dedupe_key", name="uq_notifications_user_dedupe"
        ),
    )
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_notifications_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            "ix_notifications_user_created",
            ["user_id", "created_at"],
            unique=False,
        )
        batch_op.create_index(
            "ix_notifications_user_read",
            ["user_id", "read_at"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.drop_index("ix_notifications_user_read")
        batch_op.drop_index("ix_notifications_user_created")
        batch_op.drop_index(batch_op.f("ix_notifications_user_id"))
    op.drop_table("notifications")

    with op.batch_alter_table("user_settings", schema=None) as batch_op:
        for name in reversed(_PREF_COLUMNS):
            batch_op.drop_column(name)
