from sqlalchemy import text

from app.db.base import Base
from app.db.session import engine

# Ensure model imports register metadata.
from app.db import models  # noqa: F401


async def _ensure_user_full_name_column() -> None:
    async with engine.begin() as conn:
        dialect = conn.dialect.name
        if dialect == "postgresql":
            result = await conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'full_name'"
                )
            )
            if result.scalar_one_or_none():
                return
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT 'Learner'")
            )
            return

        if dialect == "sqlite":
            result = await conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            if "full_name" in columns:
                return
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120) NOT NULL DEFAULT 'Learner'")
            )


async def _ensure_flashcards_unique_word_per_user() -> None:
    async with engine.begin() as conn:
        dialect = conn.dialect.name

        if dialect == "postgresql":
            await conn.execute(
                text(
                    """
                    WITH ranked AS (
                        SELECT
                            id,
                            row_number() OVER (
                                PARTITION BY user_id, lower(word)
                                ORDER BY created_at ASC, id ASC
                            ) AS rn
                        FROM flashcards
                    )
                    DELETE FROM flashcards f
                    USING ranked r
                    WHERE f.id = r.id AND r.rn > 1
                    """
                )
            )
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_flashcards_user_word_ci "
                    "ON flashcards (user_id, lower(word))"
                )
            )
            return

        if dialect == "sqlite":
            await conn.execute(
                text(
                    """
                    DELETE FROM flashcards
                    WHERE rowid NOT IN (
                        SELECT MIN(rowid)
                        FROM flashcards
                        GROUP BY user_id, lower(word)
                    )
                    """
                )
            )
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_flashcards_user_word_ci "
                    "ON flashcards (user_id, lower(word))"
                )
            )


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_user_full_name_column()
    await _ensure_flashcards_unique_word_per_user()
