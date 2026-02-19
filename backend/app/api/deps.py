from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenError, decode_access_token
from app.db.models import User
from app.db.session import get_db
from app.middleware.rate_limit import rate_limit_dependency
from app.services.llm_router import LLMRouter

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

_auth_limiter = rate_limit_dependency(settings.rate_limit_auth)
_chat_limiter = rate_limit_dependency(settings.rate_limit_chat)
_llm_router_singleton: LLMRouter | None = None


def get_auth_rate_limit_dep():
    return _auth_limiter


def get_chat_rate_limit_dep():
    return _chat_limiter


def get_llm_router() -> LLMRouter:
    global _llm_router_singleton
    if _llm_router_singleton is None:
        _llm_router_singleton = LLMRouter()
    return _llm_router_singleton


async def get_current_user(
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
    return user
