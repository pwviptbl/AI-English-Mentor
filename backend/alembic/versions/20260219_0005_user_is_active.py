"""Migração 005 — Adiciona is_active ao users (cadastro requer ativação pelo admin).

Revision ID: 20260219_0005
Revises: 20260219_0004
Create Date: 2026-02-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260219_0005"
down_revision: Union[str, None] = "20260219_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='is_active'"
    ))
    if not result.scalar():
        op.add_column(
            "users",
            sa.Column(
                "is_active",
                sa.Boolean(),
                nullable=False,
                server_default="true",
            ),
        )
        op.create_index(op.f("ix_users_is_active"), "users", ["is_active"], unique=False)

    # Garante que todos os existentes fiquem ativos
    op.execute("UPDATE users SET is_active = true WHERE is_active IS NULL")


def downgrade() -> None:
    op.drop_index(op.f("ix_users_is_active"), table_name="users")
    op.drop_column("users", "is_active")
