from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.db.session import get_db
from app.schemas.admin import ProfileUpdate
from app.schemas.auth import UserResponse
from app.schemas.providers import ProviderPreferenceUpdate

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_PROVIDERS = {"gemini"}


@router.patch("/preferences/provider", response_model=UserResponse)
async def update_provider_preference(
    payload: ProviderPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    provider = payload.preferred_ai_provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="unsupported provider")

    current_user.preferred_ai_provider = provider
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Atualiza nome e/ou senha do usuário logado."""
    if payload.full_name is not None:
        name = payload.full_name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="full_name must have at least 2 characters")
        current_user.full_name = name

    if payload.new_password is not None:
        if not payload.current_password:
            raise HTTPException(status_code=400, detail="current_password is required to change password")
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="current_password is incorrect")
        if len(payload.new_password) < 8:
            raise HTTPException(status_code=400, detail="new_password must have at least 8 characters")
        current_user.password_hash = hash_password(payload.new_password)

    await db.commit()
    await db.refresh(current_user)
    return current_user

