from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_chat_rate_limit_dep, get_current_user, get_daily_limit_dep, get_llm_router
from app.db.models import User
from app.schemas.reading import ReadingGenerateRequest, ReadingGenerateResponse, ReadingQuestionResponse
from app.services.errors import ProviderError
from app.services.llm_router import LLMRouter

router = APIRouter(prefix="/reading", tags=["reading"])


@router.post("/generate", response_model=ReadingGenerateResponse, dependencies=[Depends(get_chat_rate_limit_dep()), Depends(get_daily_limit_dep())])
async def generate_reading_activity(
    payload: ReadingGenerateRequest,
    current_user: User = Depends(get_current_user),
    llm_router: LLMRouter = Depends(get_llm_router),
) -> ReadingGenerateResponse:
    context = {
        "learner_name": current_user.full_name,
        "cefr_level": payload.cefr_level or "B1",
        "question_language": payload.question_language or "en",
    }

    try:
        activity, provider_name, model_name = await llm_router.generate_reading_activity(
            theme=payload.theme,
            context=context,
            provider_override=payload.provider_override,
            user_preference=current_user.preferred_ai_provider,
        )
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail=f"provider unavailable: {exc}")

    if not activity.passage.strip() or len(activity.questions) < 4:
        raise HTTPException(status_code=502, detail="reading activity generation failed")

    return ReadingGenerateResponse(
        title=activity.title,
        theme=activity.theme,
        passage=activity.passage,
        question_language=activity.question_language,
        questions=[
            ReadingQuestionResponse(
                question=question.question,
                options=question.options,
                correct_option=question.correct_option,
                explanation=question.explanation,
            )
            for question in activity.questions
        ],
        provider_used=provider_name,
        model_used=model_name,
    )
