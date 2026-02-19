"""initial schema

Revision ID: 20260219_0001
Revises:
Create Date: 2026-02-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260219_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("preferred_ai_provider", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("topic", sa.String(length=120), nullable=False),
        sa.Column("persona_prompt", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content_raw", sa.Text(), nullable=True),
        sa.Column("content_corrected", sa.Text(), nullable=True),
        sa.Column("content_final", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("meta_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_messages_session_id"), "messages", ["session_id"], unique=False)

    op.create_table(
        "flashcards",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("word", sa.String(length=120), nullable=False),
        sa.Column("lemma", sa.String(length=120), nullable=True),
        sa.Column("pos", sa.String(length=32), nullable=True),
        sa.Column("translation", sa.String(length=240), nullable=True),
        sa.Column("definition", sa.Text(), nullable=True),
        sa.Column("context_sentence", sa.Text(), nullable=True),
        sa.Column("next_review", sa.DateTime(timezone=True), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("ease_factor", sa.Float(), nullable=False),
        sa.Column("lapses", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_flashcards_next_review"), "flashcards", ["next_review"], unique=False)
    op.create_index(op.f("ix_flashcards_user_id"), "flashcards", ["user_id"], unique=False)
    op.create_index(op.f("ix_flashcards_word"), "flashcards", ["word"], unique=False)

    op.create_table(
        "review_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("flashcard_id", sa.String(length=36), nullable=False),
        sa.Column("rating", sa.String(length=16), nullable=False),
        sa.Column("old_interval", sa.Integer(), nullable=False),
        sa.Column("new_interval", sa.Integer(), nullable=False),
        sa.Column("old_ef", sa.Float(), nullable=False),
        sa.Column("new_ef", sa.Float(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["flashcard_id"], ["flashcards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_review_logs_flashcard_id"), "review_logs", ["flashcard_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_review_logs_flashcard_id"), table_name="review_logs")
    op.drop_table("review_logs")

    op.drop_index(op.f("ix_flashcards_word"), table_name="flashcards")
    op.drop_index(op.f("ix_flashcards_user_id"), table_name="flashcards")
    op.drop_index(op.f("ix_flashcards_next_review"), table_name="flashcards")
    op.drop_table("flashcards")

    op.drop_index(op.f("ix_messages_session_id"), table_name="messages")
    op.drop_table("messages")

    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
