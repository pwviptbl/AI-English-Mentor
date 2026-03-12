"""add edge tts voice to users

Revision ID: 20260311_0007
Revises: 20260219_0006
Create Date: 2026-03-11 00:07:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260311_0007"
down_revision: Union[str, None] = "20260219_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("users")]
    if "edge_tts_voice" not in columns:
        op.add_column(
            "users",
            sa.Column("edge_tts_voice", sa.String(length=64), nullable=False, server_default="en-US-JennyNeural"),
        )
        op.alter_column("users", "edge_tts_voice", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("users")]
    if "edge_tts_voice" in columns:
        op.drop_column("users", "edge_tts_voice")