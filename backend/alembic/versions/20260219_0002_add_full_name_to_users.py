"""add full_name to users

Revision ID: 20260219_0002
Revises: 20260219_0001
Create Date: 2026-02-19 00:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260219_0002"
down_revision: Union[str, None] = "20260219_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("users")]
    if "full_name" in columns:
        return

    op.add_column(
        "users",
        sa.Column("full_name", sa.String(length=120), nullable=False, server_default="Learner"),
    )
    op.alter_column("users", "full_name", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("users")]
    if "full_name" not in columns:
        return

    op.drop_column("users", "full_name")
