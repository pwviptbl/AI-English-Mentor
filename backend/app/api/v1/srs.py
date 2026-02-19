"""API SRS — Flashcards e Revisões com algoritmo FSRS v4."""

from datetime import UTC, datetime, time, timedelta
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.models import Flashcard, ReviewLog, User
from app.db.session import get_db
from app.schemas.srs import (
    DailyReviewStat,
    FlashcardCreate,
    FlashcardResponse,
    ProgressOverview,
    ReviewRequest,
    ReviewResponse,
    ReviewStatsResponse,
)
from app.services.fsrs import apply_fsrs

router = APIRouter(tags=["srs"])
logger = get_logger(__name__)


def _normalize_deck_word(word: str) -> str:
    return re.sub(r"[^A-Za-z'-]+", "", word).strip().lower()


@router.post("/flashcards", response_model=FlashcardResponse)
async def create_flashcard(
    payload: FlashcardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlashcardResponse:
    normalized_word = _normalize_deck_word(payload.word)
    if not normalized_word:
        raise HTTPException(status_code=400, detail="invalid word")

    existing_stmt = select(Flashcard).where(
        Flashcard.user_id == current_user.id,
        func.lower(Flashcard.word) == normalized_word,
    ).limit(1)
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="word already in deck")

    flashcard = Flashcard(
        user_id=current_user.id,
        word=normalized_word,
        lemma=payload.lemma,
        pos=payload.pos,
        translation=payload.translation,
        definition=payload.definition,
        context_sentence=payload.context_sentence,
    )
    db.add(flashcard)
    try:
        await db.commit()
        await db.refresh(flashcard)
        return flashcard
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Failed to persist flashcard word=%s user_id=%s", normalized_word, current_user.id)

        existing_after_error = (
            await db.execute(
                select(Flashcard).where(
                    Flashcard.user_id == current_user.id,
                    func.lower(Flashcard.word) == normalized_word,
                ).limit(1)
            )
        ).scalar_one_or_none()
        if existing_after_error:
            raise HTTPException(status_code=409, detail="word already in deck")

        raise HTTPException(status_code=500, detail=f"failed to persist flashcard: {exc.__class__.__name__}") from exc


@router.get("/flashcards/due", response_model=list[FlashcardResponse])
async def due_flashcards(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FlashcardResponse]:
    now = datetime.now(UTC)
    stmt = (
        select(Flashcard)
        .where(Flashcard.user_id == current_user.id, Flashcard.next_review <= now)
        .order_by(Flashcard.next_review.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post("/reviews", response_model=ReviewResponse)
async def review_flashcard(
    payload: ReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewResponse:
    stmt = select(Flashcard).where(
        Flashcard.id == payload.flashcard_id,
        Flashcard.user_id == current_user.id,
    )
    flashcard = (await db.execute(stmt)).scalar_one_or_none()
    if not flashcard:
        raise HTTPException(status_code=404, detail="flashcard not found")

    old_interval = flashcard.interval_days
    old_ef = flashcard.ease_factor

    # Aplica FSRS v4 em vez de SM-2
    updated = apply_fsrs(
        rating=payload.rating,
        current_interval=flashcard.interval_days,
        current_repetitions=flashcard.repetitions,
        current_ef=flashcard.ease_factor,
        stability=flashcard.stability,
        difficulty=flashcard.difficulty,
    )

    flashcard.interval_days = updated.interval_days
    flashcard.repetitions = updated.repetitions
    flashcard.ease_factor = updated.ease_factor
    flashcard.stability = updated.stability
    flashcard.difficulty = updated.difficulty
    flashcard.next_review = updated.next_review
    flashcard.lapses += updated.lapses_increment

    log = ReviewLog(
        flashcard_id=flashcard.id,
        rating=payload.rating,
        old_interval=old_interval,
        new_interval=updated.interval_days,
        old_ef=old_ef,
        new_ef=updated.ease_factor,
    )
    db.add(log)
    await db.commit()

    return ReviewResponse(
        flashcard_id=flashcard.id,
        rating=payload.rating,
        next_review=flashcard.next_review,
        interval_days=flashcard.interval_days,
        repetitions=flashcard.repetitions,
        ease_factor=flashcard.ease_factor,
        stability=flashcard.stability,
        difficulty=flashcard.difficulty,
    )


@router.get("/reviews/stats", response_model=ReviewStatsResponse)
async def review_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewStatsResponse:
    now = datetime.now(UTC)
    today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)

    total_cards = (
        await db.execute(select(func.count(Flashcard.id)).where(Flashcard.user_id == current_user.id))
    ).scalar_one()

    due_now = (
        await db.execute(
            select(func.count(Flashcard.id)).where(
                Flashcard.user_id == current_user.id,
                Flashcard.next_review <= now,
            )
        )
    ).scalar_one()

    reviews_today = (
        await db.execute(
            select(func.count(ReviewLog.id))
            .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
            .where(
                Flashcard.user_id == current_user.id,
                ReviewLog.reviewed_at >= today_start,
            )
        )
    ).scalar_one()

    return ReviewStatsResponse(
        total_cards=int(total_cards),
        due_now=int(due_now),
        reviews_today=int(reviews_today),
    )


@router.get("/reviews/history", response_model=list[DailyReviewStat])
async def review_history(
    days: int = 14,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DailyReviewStat]:
    """Retorna estatísticas diárias de revisão dos últimos N dias."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=min(days, 30))

    rows = (
        await db.execute(
            select(ReviewLog.reviewed_at, ReviewLog.rating)
            .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
            .where(
                Flashcard.user_id == current_user.id,
                ReviewLog.reviewed_at >= cutoff,
            )
        )
    ).all()

    # Agrupa por data
    daily: dict[str, dict] = {}
    for reviewed_at, rating in rows:
        date_key = reviewed_at.date().isoformat()
        if date_key not in daily:
            daily[date_key] = {"count": 0, "good": 0}
        daily[date_key]["count"] += 1
        if rating in ("good", "easy"):
            daily[date_key]["good"] += 1

    result: list[DailyReviewStat] = []
    for date_key in sorted(daily.keys()):
        d = daily[date_key]
        result.append(DailyReviewStat(
            date=date_key,
            count=d["count"],
            accuracy=round(d["good"] / d["count"], 3) if d["count"] else 0.0,
        ))
    return result


@router.get("/stats/overview", response_model=ProgressOverview)
async def progress_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressOverview:
    """Dashboard pessoal: streak, palavras aprendidas e taxa de acerto."""
    now = datetime.now(UTC)
    today_start = datetime.combine(now.date(), time.min, tzinfo=UTC)

    # Total de revisões e taxa de acerto global
    all_reviews = (
        await db.execute(
            select(ReviewLog.rating, ReviewLog.reviewed_at)
            .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
            .where(Flashcard.user_id == current_user.id)
        )
    ).all()

    total_reviews = len(all_reviews)
    good_reviews = sum(1 for r, _ in all_reviews if r in ("good", "easy"))
    accuracy_rate = round(good_reviews / total_reviews, 3) if total_reviews else 0.0

    # Revisões hoje
    reviews_today = sum(1 for _, reviewed_at in all_reviews if reviewed_at >= today_start)

    # Palavras "aprendidas" (repetitions >= 2)
    total_learned = (
        await db.execute(
            select(func.count(Flashcard.id)).where(
                Flashcard.user_id == current_user.id,
                Flashcard.repetitions >= 2,
            )
        )
    ).scalar_one()

    # Streak: dias consecutivos com pelo menos 1 revisão
    dates_with_reviews = sorted(
        {r.date() for _, r in all_reviews},
        reverse=True,
    )
    streak = 0
    if dates_with_reviews:
        expected = now.date()
        for d in dates_with_reviews:
            if d == expected:
                streak += 1
                expected = d - timedelta(days=1)
            elif d == now.date() - timedelta(days=streak):
                streak += 1
                expected = d - timedelta(days=1)
            else:
                break

    # Histórico dos últimos 14 dias
    cutoff_14 = now - timedelta(days=14)
    recent_reviews = [(r, dt) for r, dt in all_reviews if dt >= cutoff_14]
    daily: dict[str, dict] = {}
    for rating, reviewed_at in recent_reviews:
        date_key = reviewed_at.date().isoformat()
        if date_key not in daily:
            daily[date_key] = {"count": 0, "good": 0}
        daily[date_key]["count"] += 1
        if rating in ("good", "easy"):
            daily[date_key]["good"] += 1

    daily_history = [
        DailyReviewStat(
            date=k,
            count=v["count"],
            accuracy=round(v["good"] / v["count"], 3) if v["count"] else 0.0,
        )
        for k, v in sorted(daily.items())
    ]

    return ProgressOverview(
        streak_days=streak,
        total_learned=int(total_learned),
        accuracy_rate=accuracy_rate,
        reviews_today=reviews_today,
        daily_history=daily_history,
    )
