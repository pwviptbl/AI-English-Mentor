"""Analysis for messages and reading texts with caching to reduce repeated LLM calls."""

import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_daily_analysis_limit_dep, get_llm_router
from app.core.logging import get_logger
from app.db.models import AnalysisCache, Message, Session, User
from app.db.session import get_db
from app.schemas.analysis import MessageAnalysisResponse, TextAnalysisRequest, TokenInfo
from app.services.errors import ProviderError
from app.services.llm_router import LLMRouter
from app.services.llm_types import SentenceAnalysis, TokenAnalysis

router = APIRouter(prefix="/messages", tags=["analysis"])
text_router = APIRouter(prefix="/analysis", tags=["analysis"])
logger = get_logger(__name__)


def _sentence_hash(sentence: str) -> str:
    """Build a SHA-256 hash for text cache lookups."""
    return hashlib.sha256(sentence.strip().lower().encode()).hexdigest()


def _cache_to_analysis(data: dict) -> SentenceAnalysis:
    """Rebuild SentenceAnalysis from cached JSON payload."""
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
    """Serialize SentenceAnalysis for cache storage."""
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


def _response_from_result(result: SentenceAnalysis) -> MessageAnalysisResponse:
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


async def _analyze_text_with_cache(
    *,
    text: str,
    context: dict,
    llm_router: LLMRouter,
    current_user: User,
    db: AsyncSession,
    provider_override: str | None = None,
    cache_scope: str = "text",
) -> tuple[SentenceAnalysis, str, str]:
    candidate = text.strip()
    h = _sentence_hash(f"{cache_scope}:{candidate}")

    cached = (
        await db.execute(select(AnalysisCache).where(AnalysisCache.sentence_hash == h))
    ).scalar_one_or_none()

    if cached:
        logger.info("analysis.cache_hit scope=%s", cache_scope)
        return _cache_to_analysis(cached.analysis_json), cached.provider or "cache", cached.model or "cache"

    result, provider_name, model_name = await llm_router.analyze_sentence(
        sentence_en=candidate,
        context=context,
        provider_override=provider_override,
        user_preference=current_user.preferred_ai_provider,
    )

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
        await db.rollback()

    return result, provider_name, model_name


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

    try:
        result, provider_name, model_name = await _analyze_text_with_cache(
            text=message.content_final,
            context={
                "topic": session.topic,
                "persona_prompt": session.persona_prompt,
            },
            llm_router=llm_router,
            current_user=current_user,
            db=db,
            provider_override=provider_override,
            cache_scope="message",
        )
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

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

    return _response_from_result(result)


@text_router.post("/text", response_model=MessageAnalysisResponse, dependencies=[Depends(get_daily_analysis_limit_dep())])
async def analyze_text(
    payload: TextAnalysisRequest,
    provider_override: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    llm_router: LLMRouter = Depends(get_llm_router),
) -> MessageAnalysisResponse:
    text = payload.text.strip()
    if len(text) < 2:
        raise HTTPException(status_code=422, detail="text is too short")

    try:
        result, provider_name, model_name = await _analyze_text_with_cache(
            text=text,
            context={
                "topic": "reading_text",
                "persona_prompt": "Analyze the full reading passage and keep token translations learner-friendly.",
            },
            llm_router=llm_router,
            current_user=current_user,
            db=db,
            provider_override=provider_override,
            cache_scope="reading_text",
        )
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

    logger.info(
        "analysis.text_completed",
        extra={
            "user_id": current_user.id,
            "provider": provider_name,
            "model": model_name,
            "token_count": len(result.tokens),
            "text_length": len(text),
        },
    )

    return _response_from_result(result)
