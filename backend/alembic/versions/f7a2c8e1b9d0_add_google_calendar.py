"""add_google_calendar_tables

Revision ID: f7a2c8e1b9d0
Revises: c3f9a1b2d4e5
Create Date: 2026-11-11 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7a2c8e1b9d0"
down_revision: Union[str, None] = "c3f9a1b2d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "google_calendar_connections",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("google_account_email", sa.String(), nullable=True),
        sa.Column("google_account_id", sa.String(), nullable=True),
        sa.Column("access_token_enc", sa.Text(), nullable=False),
        sa.Column("refresh_token_enc", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.Text(), nullable=True),
        sa.Column("scopes", sa.Text(), nullable=False),
        sa.Column("calendar_id", sa.String(), nullable=False),
        sa.Column("last_sync_at", sa.Text(), nullable=True),
        sa.Column("last_sync_status", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_google_calendar_connections_user"),
    )
    op.create_index(
        "ix_google_calendar_connections_user",
        "google_calendar_connections",
        ["user_id"],
    )

    op.create_table(
        "habit_google_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("habit_id", sa.String(), nullable=False),
        sa.Column("google_event_id", sa.String(), nullable=False),
        sa.Column("calendar_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("habit_id", name="uq_habit_google_events_habit"),
        sa.UniqueConstraint(
            "user_id", "google_event_id", name="uq_habit_google_events_user_event"
        ),
    )
    op.create_index(
        "ix_habit_google_events_user", "habit_google_events", ["user_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_habit_google_events_user", table_name="habit_google_events")
    op.drop_table("habit_google_events")
    op.drop_index(
        "ix_google_calendar_connections_user",
        table_name="google_calendar_connections",
    )
    op.drop_table("google_calendar_connections")
