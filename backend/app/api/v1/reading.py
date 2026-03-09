from datetime import UTC, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_chat_rate_limit_dep, get_current_user, get_daily_limit_dep, get_llm_router
from app.db.models import ReadingAttempt, User
from app.db.session import get_db
from app.schemas.reading import (
    DailyReadingStat,
    ReadingAttemptCreateRequest,
    ReadingAttemptResponse,
    ReadingGenerateRequest,
    ReadingGenerateResponse,
    ReadingProgressOverview,
    ReadingQuestionResponse,
)
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


@router.post("/attempts", response_model=ReadingAttemptResponse)
async def create_reading_attempt(
    payload: ReadingAttemptCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingAttemptResponse:
    if payload.correct_answers > payload.total_questions:
        raise HTTPException(status_code=400, detail="correct_answers cannot exceed total_questions")

    accuracy_rate = round(payload.correct_answers / payload.total_questions, 3)
    attempt = ReadingAttempt(
        user_id=current_user.id,
        title=payload.title.strip(),
        theme=payload.theme.strip(),
        question_language=payload.question_language,
        total_questions=payload.total_questions,
        correct_answers=payload.correct_answers,
        accuracy_rate=accuracy_rate,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    return ReadingAttemptResponse(
        id=attempt.id,
        title=attempt.title,
        theme=attempt.theme,
        question_language=attempt.question_language,
        total_questions=attempt.total_questions,
        correct_answers=attempt.correct_answers,
        accuracy_rate=attempt.accuracy_rate,
        completed_at=attempt.completed_at.isoformat(),
    )


@router.get("/progress", response_model=ReadingProgressOverview)
async def reading_progress_overview(
    days: int = 14,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadingProgressOverview:
    now = datetime.now(UTC)
    today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)
    cutoff = now - timedelta(days=min(days, 30))

    attempts = (
        await db.execute(
            select(ReadingAttempt)
            .where(ReadingAttempt.user_id == current_user.id)
            .order_by(ReadingAttempt.completed_at.asc())
        )
    ).scalars().all()

    completed_activities = len(attempts)
    total_questions_answered = sum(item.total_questions for item in attempts)
    correct_answers = sum(item.correct_answers for item in attempts)
    accuracy_rate = round(correct_answers / total_questions_answered, 3) if total_questions_answered else 0.0
    activities_today = sum(1 for item in attempts if item.completed_at >= today_start)

    recent_attempts = [item for item in attempts if item.completed_at >= cutoff]
    daily: dict[str, dict[str, float]] = {}
    for item in recent_attempts:
        date_key = item.completed_at.date().isoformat()
        if date_key not in daily:
            daily[date_key] = {"count": 0, "correct": 0, "total": 0}
        daily[date_key]["count"] += 1
        daily[date_key]["correct"] += item.correct_answers
        daily[date_key]["total"] += item.total_questions

    daily_history = [
        DailyReadingStat(
            date=date_key,
            count=int(values["count"]),
            accuracy=round(values["correct"] / values["total"], 3) if values["total"] else 0.0,
        )
        for date_key, values in sorted(daily.items())
    ]

    return ReadingProgressOverview(
        completed_activities=completed_activities,
        total_questions_answered=total_questions_answered,
        correct_answers=correct_answers,
        accuracy_rate=accuracy_rate,
        activities_today=activities_today,
        daily_history=daily_history,
    )
