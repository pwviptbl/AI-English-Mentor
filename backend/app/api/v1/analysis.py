from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_llm_router
from app.db.models import Message, Session, User
from app.db.session import get_db
from app.schemas.analysis import MessageAnalysisResponse, TokenInfo
from app.services.errors import ProviderError
from app.services.llm_router import LLMRouter

router = APIRouter(prefix="/messages", tags=["analysis"])


@router.post("/{message_id}/analysis", response_model=MessageAnalysisResponse)
async def analyze_message(
    message_id: str,
    provider_override: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    llm_router: LLMRouter = Depends(get_llm_router),
) -> MessageAnalysisResponse:
    stmt = (
        select(Message, Session)
        .join(Session, Message.session_id == Session.id)
        .where(Message.id == message_id, Session.user_id == current_user.id)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        raise HTTPException(status_code=404, detail="message not found")

    message, session = row
    if message.role != "assistant":
        raise HTTPException(status_code=400, detail="analysis is only available for assistant messages")

    context = {
        "topic": session.topic,
        "persona_prompt": session.persona_prompt,
    }

    try:
        result, _provider, _model = await llm_router.analyze_sentence(
            sentence_en=message.content_final,
            context=context,
            provider_override=provider_override,
            user_preference=current_user.preferred_ai_provider,
        )
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

    return MessageAnalysisResponse(
        original_en=result.original_en,
        translation_pt=result.translation_pt,
        tokens=[
            TokenInfo(
                token=tok.token,
                lemma=tok.lemma,
                pos=tok.pos,
                translation=tok.translation,
                definition=tok.definition,
            )
            for tok in result.tokens
        ],
    )
