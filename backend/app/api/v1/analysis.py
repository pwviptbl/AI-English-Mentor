"""Análise de mensagens com cache de sentença para evitar chamadas repetidas à LLM."""

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_daily_analysis_limit_dep, get_llm_router
from app.core.logging import get_logger
from app.db.models import AnalysisCache, Message, Session, User
from app.db.session import get_db
from app.schemas.analysis import MessageAnalysisResponse, TokenInfo
from app.services.errors import ProviderError
from app.services.llm_router import LLMRouter
from app.services.llm_types import SentenceAnalysis, TokenAnalysis

router = APIRouter(prefix="/messages", tags=["analysis"])
logger = get_logger(__name__)


def _sentence_hash(sentence: str) -> str:
    """Gera hash SHA-256 da sentença para lookup no cache."""
    return hashlib.sha256(sentence.strip().lower().encode()).hexdigest()


def _cache_to_analysis(data: dict) -> SentenceAnalysis:
    """Reconstrói SentenceAnalysis a partir do JSON armazenado no cache."""
    tokens = [
        TokenAnalysis(
            token=t.get("token", ""),
            lemma=t.get("lemma"),
            pos=t.get("pos"),
            translation=t.get("translation"),
            definition=t.get("definition"),
        )
        for t in data.get("tokens", [])
    ]
    return SentenceAnalysis(
        original_en=data.get("original_en", ""),
        translation_pt=data.get("translation_pt", ""),
        tokens=tokens,
    )


def _analysis_to_dict(result: SentenceAnalysis) -> dict:
    """Serializa SentenceAnalysis para armazenamento no cache."""
    return {
        "original_en": result.original_en,
        "translation_pt": result.translation_pt,
        "tokens": [
            {
                "token": t.token,
                "lemma": t.lemma,
                "pos": t.pos,
                "translation": t.translation,
                "definition": t.definition,
            }
            for t in result.tokens
        ],
    }


@router.post("/{message_id}/analysis", response_model=MessageAnalysisResponse, dependencies=[Depends(get_daily_analysis_limit_dep())])
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

    # -- Verificar cache antes de chamar a LLM --
    sentence = message.content_final
    h = _sentence_hash(sentence)

    cached = (
        await db.execute(select(AnalysisCache).where(AnalysisCache.sentence_hash == h))
    ).scalar_one_or_none()

    if cached:
        logger.info("analysis.cache_hit message_id=%s", message_id)
        result = _cache_to_analysis(cached.analysis_json)
        provider_name = cached.provider or "cache"
        model_name = cached.model or "cache"
    else:
        context = {
            "topic": session.topic,
            "persona_prompt": session.persona_prompt,
        }
        try:
            result, provider_name, model_name = await llm_router.analyze_sentence(
                sentence_en=sentence,
                context=context,
                provider_override=provider_override,
                user_preference=current_user.preferred_ai_provider,
            )
        except ProviderError as exc:
            raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

        # Persistir no cache
        cache_entry = AnalysisCache(
            sentence_hash=h,
            analysis_json=_analysis_to_dict(result),
            provider=provider_name,
            model=model_name,
        )
        db.add(cache_entry)
        try:
            await db.commit()
        except Exception:
            await db.rollback()  # ignora erro de concorrência no cache

        logger.info(
            "analysis.completed",
            extra={
                "user_id": current_user.id,
                "session_id": session.id,
                "message_id": message.id,
                "message_role": message.role,
                "provider": provider_name,
                "model": model_name,
                "token_count": len(result.tokens),
            },
        )

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
