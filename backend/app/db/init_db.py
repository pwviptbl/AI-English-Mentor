import asyncio

from sqlalchemy import select
from sqlalchemy.exc import DBAPIError, OperationalError

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.models import TierLimits, User

logger = get_logger(__name__)


async def _ensure_admin_user() -> None:
    """Cria a conta admin padrão se ainda não existir."""
    from app.db.session import AsyncSessionLocal  # local import para evitar ciclo
    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(select(User).where(User.email == settings.admin_email))
        ).scalar_one_or_none()
        if existing:
            # garante que o admin padrão seja sempre admin e ativo mesmo após reset
            changed = False
            if not existing.is_admin:
                existing.is_admin = True
                changed = True
            if not existing.is_active:
                existing.is_active = True
                changed = True
            if changed:
                await db.commit()
            return
        admin = User(
            full_name="Admin",
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            tier="pro",
            is_admin=True,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
    logger.info("db.admin_user.created email=%s", settings.admin_email)


async def _ensure_tier_limits() -> None:
    """Garante que as linhas free e pro existam na tabela tier_limits."""
    from app.db.session import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        for tier, chat, analysis in [("free", 20, 10), ("pro", 100, 50)]:
            existing = (
                await db.execute(select(TierLimits).where(TierLimits.tier == tier))
            ).scalar_one_or_none()
            if not existing:
                db.add(TierLimits(tier=tier, daily_chat_limit=chat, daily_analysis_limit=analysis))
        await db.commit()
    logger.info("db.tier_limits.ensured")


async def _run_init_db_once() -> None:
    # O schema é gerenciado exclusivamente pelo Alembic (alembic upgrade head).
    # Aqui apenas garantimos os dados iniciais obrigatórios.
    await _ensure_tier_limits()
    await _ensure_admin_user()


async def init_db() -> None:
    max_retries = max(settings.db_init_max_retries, 0)
    delay_seconds = max(settings.db_init_retry_delay_seconds, 0.1)
    attempts = max_retries + 1

    for attempt in range(1, attempts + 1):
        try:
            await _run_init_db_once()
            if attempt > 1:
                logger.info(
                    "db.init.recovered",
                    extra={"attempt": attempt, "attempts_total": attempts},
                )
            return
        except (OperationalError, DBAPIError, OSError) as exc:
            if attempt == attempts:
                logger.exception(
                    "db.init.failed",
                    extra={"attempt": attempt, "attempts_total": attempts},
                )
                raise

            logger.warning(
                "db.init.retrying",
                extra={
                    "attempt": attempt,
                    "attempts_total": attempts,
                    "retry_in_seconds": delay_seconds,
                    "error_type": type(exc).__name__,
                },
            )
            await asyncio.sleep(delay_seconds)
