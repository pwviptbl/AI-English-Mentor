from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_chat_rate_limit_dep, get_current_user, get_llm_router
from app.db.models import User
from app.db.session import get_db
from app.schemas.chat import ChatSendRequest, ChatSendResponse
from app.services.chat_service import ChatService
from app.services.errors import ProviderError
from app.services.llm_router import LLMRouter

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/send", response_model=ChatSendResponse, dependencies=[Depends(get_chat_rate_limit_dep())])
async def send_chat(
    payload: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    llm_router: LLMRouter = Depends(get_llm_router),
) -> ChatSendResponse:
    service = ChatService(db, llm_router)
    try:
        response = await service.send_message(current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

    return ChatSendResponse(**response)
