from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import UserResponse
from app.schemas.providers import ProviderPreferenceUpdate

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_PROVIDERS = {"gemini", "copilot"}


@router.patch("/preferences/provider", response_model=UserResponse)
async def update_provider_preference(
    payload: ProviderPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    provider = payload.preferred_ai_provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail="unsupported provider")
    if provider == "copilot" and not settings.enable_copilot:
        raise HTTPException(status_code=400, detail="copilot provider is disabled")

    current_user.preferred_ai_provider = provider
    await db.commit()
    await db.refresh(current_user)
    return current_user
