from time import monotonic
from typing import Literal

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenError, decode_access_token
from app.db.models import TierLimits, User
from app.db.session import get_db
from app.middleware.rate_limit import SECONDS_PER_DAY, daily_user_limiter, rate_limit_dependency
from app.services.llm_router import LLMRouter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

_auth_limiter = rate_limit_dependency(settings.rate_limit_auth)
_chat_limiter = rate_limit_dependency(settings.rate_limit_chat)
_llm_router_singleton: LLMRouter | None = None


# ── get_current_user — deve ser definido ANTES de qualquer Depends que o usa ──

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
    except TokenError:
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise credentials_exception
    request.state.user_id = user.id
    return user


# ── require_admin ─────────────────────────────────────────────────────────────

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency que garante que o usuário logado seja admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin privileges required",
        )
    return current_user


# ── LLM router ────────────────────────────────────────────────────────────────

def get_llm_router() -> LLMRouter:
    global _llm_router_singleton
    if _llm_router_singleton is None:
        _llm_router_singleton = LLMRouter()
    return _llm_router_singleton


# ── Rate limit helpers ────────────────────────────────────────────────────────

def get_auth_rate_limit_dep():
    return _auth_limiter


def get_chat_rate_limit_dep():
    return _chat_limiter


# ── Cache de tier limits (TTL = 60 s) ─────────────────────────────────────────

_tier_limits_cache: dict[str, dict[str, int]] = {}
_tier_limits_fetched_at: float = 0.0
_TIER_CACHE_TTL = 60.0


def invalidate_tier_limits_cache() -> None:
    global _tier_limits_fetched_at
    _tier_limits_fetched_at = 0.0


async def _get_limits_for_tier(db: AsyncSession, tier: str) -> tuple[int, int]:
    """Retorna (daily_chat_limit, daily_analysis_limit) para o tier, com cache de 60 s."""
    global _tier_limits_cache, _tier_limits_fetched_at

    now = monotonic()
    if now - _tier_limits_fetched_at > _TIER_CACHE_TTL or tier not in _tier_limits_cache:
        rows = (await db.execute(select(TierLimits))).scalars().all()
        _tier_limits_cache = {
            row.tier: {"chat": row.daily_chat_limit, "analysis": row.daily_analysis_limit}
            for row in rows
        }
        _tier_limits_fetched_at = now

    limits = _tier_limits_cache.get(tier, {})
    chat = limits.get("chat", settings.daily_message_limit)
    analysis = limits.get("analysis", settings.daily_analysis_limit)
    return chat, analysis


# ── Limites diários por tier ──────────────────────────────────────────────────

def _make_daily_dep(key_prefix: str, limit_type: Literal["chat", "analysis"], label: str):
    """Fábrica de dependências de limite diário por usuário baseado no tier (janela 24 h)."""
    async def dependency(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> None:
        chat_limit, analysis_limit = await _get_limits_for_tier(db, current_user.tier)
        limit = chat_limit if limit_type == "chat" else analysis_limit
        key = f"{key_prefix}:{current_user.id}"
        allowed = daily_user_limiter.check(key, limit=limit, window_seconds=SECONDS_PER_DAY)
        if not allowed:
            used = daily_user_limiter.count(key, window_seconds=SECONDS_PER_DAY)
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Limite diário de {label} atingido ({used}/{limit}) para o seu plano '{current_user.tier}'. "
                    "Sua cota será reiniciada 24 h após sua primeira solicitação de hoje."
                ),
            )
    return dependency


def get_daily_limit_dep():
    """Limite diário de mensagens de chat (2 chamadas LLM por envio)."""
    return _make_daily_dep("daily_chat", "chat", "message")


def get_daily_analysis_limit_dep():
    """Limite diário de análises de mensagem."""
    return _make_daily_dep("daily_analysis", "analysis", "analysis")
