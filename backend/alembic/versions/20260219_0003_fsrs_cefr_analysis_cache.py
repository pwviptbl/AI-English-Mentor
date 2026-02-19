"""Migração Alembic 003 — Adiciona colunas FSRS ao flashcards, cefr_level ao sessions e tabela analysis_cache.

Revision ID: 20260219_0003
Revises: 20260219_0002
Create Date: 2026-02-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# identificadores de revisão
revision: str = "20260219_0003"
down_revision: Union[str, None] = "20260219_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- campos FSRS no flashcards --
    op.add_column("flashcards", sa.Column("stability", sa.Float(), nullable=False, server_default="0.0"))
    op.add_column("flashcards", sa.Column("difficulty", sa.Float(), nullable=False, server_default="5.0"))

    # -- nível CEFR nas sessions --
    op.add_column("sessions", sa.Column("cefr_level", sa.String(length=4), nullable=True))

    # -- tabela de cache de análise de sentenças --
    op.create_table(
        "analysis_cache",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("sentence_hash", sa.String(length=64), nullable=False),
        sa.Column("analysis_json", sa.JSON(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sentence_hash"),
    )
    op.create_index(op.f("ix_analysis_cache_sentence_hash"), "analysis_cache", ["sentence_hash"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_analysis_cache_sentence_hash"), table_name="analysis_cache")
    op.drop_table("analysis_cache")
    op.drop_column("sessions", "cefr_level")
    op.drop_column("flashcards", "difficulty")
    op.drop_column("flashcards", "stability")
