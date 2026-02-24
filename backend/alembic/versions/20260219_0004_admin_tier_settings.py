"""Migração 004 — Adiciona is_admin e tier ao users; cria tabela tier_limits.

Revision ID: 20260219_0004
Revises: 20260219_0003
Create Date: 2026-02-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260219_0004"
down_revision: Union[str, None] = "20260219_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- novos campos no users --
    op.add_column(
        "users",
        sa.Column("tier", sa.String(length=16), nullable=False, server_default="free"),
    )
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index(op.f("ix_users_tier"), "users", ["tier"], unique=False)
    op.create_index(op.f("ix_users_is_admin"), "users", ["is_admin"], unique=False)

    # -- tabela de limites por tier --
    op.create_table(
        "tier_limits",
        sa.Column("tier", sa.String(length=16), primary_key=True),
        sa.Column("daily_chat_limit", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("daily_analysis_limit", sa.Integer(), nullable=False, server_default="10"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("tier"),
    )

    # -- seed das duas linhas padrão --
    op.execute(
        "INSERT INTO tier_limits (tier, daily_chat_limit, daily_analysis_limit) "
        "VALUES ('free', 20, 10), ('pro', 100, 50) "
        "ON CONFLICT (tier) DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table("tier_limits")
    op.drop_index(op.f("ix_users_is_admin"), table_name="users")
    op.drop_index(op.f("ix_users_tier"), table_name="users")
    op.drop_column("users", "is_admin")
    op.drop_column("users", "tier")
