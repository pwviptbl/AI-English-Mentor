"""Migration 006 - add reading attempt progress tracking.

Revision ID: 20260219_0006
Revises: 20260219_0005
Create Date: 2026-03-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260219_0006"
down_revision: Union[str, None] = "20260219_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name='reading_attempts'"
    ))
    if result.scalar():
        return

    op.create_table(
        "reading_attempts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("theme", sa.String(length=120), nullable=False),
        sa.Column("question_language", sa.String(length=2), nullable=False, server_default="en"),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("correct_answers", sa.Integer(), nullable=False),
        sa.Column("accuracy_rate", sa.Float(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reading_attempts_user_id"), "reading_attempts", ["user_id"], unique=False)
    op.create_index(op.f("ix_reading_attempts_theme"), "reading_attempts", ["theme"], unique=False)
    op.create_index(op.f("ix_reading_attempts_completed_at"), "reading_attempts", ["completed_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_reading_attempts_completed_at"), table_name="reading_attempts")
    op.drop_index(op.f("ix_reading_attempts_theme"), table_name="reading_attempts")
    op.drop_index(op.f("ix_reading_attempts_user_id"), table_name="reading_attempts")
    op.drop_table("reading_attempts")
