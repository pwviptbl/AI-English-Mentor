from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_llm_router
from app.core.config import settings
from app.db.models import User
from app.schemas.providers import ProviderStatusResponse
from app.services.llm_router import LLMRouter

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("/status", response_model=ProviderStatusResponse)
async def providers_status(
    llm_router: LLMRouter = Depends(get_llm_router),
    _current_user: User = Depends(get_current_user),
) -> ProviderStatusResponse:
    return ProviderStatusResponse(
        default_provider=settings.default_ai_provider,
        available_providers=llm_router.available_provider_names(),
    )
