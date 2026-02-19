from datetime import UTC, datetime, time
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.db.models import Flashcard, ReviewLog, User
from app.db.session import get_db
from app.schemas.srs import (
    FlashcardCreate,
    FlashcardResponse,
    ReviewRequest,
    ReviewResponse,
    ReviewStatsResponse,
)
from app.services.sm2 import apply_sm2

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

        # Guard against race condition between duplicate check and insert.
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

    updated = apply_sm2(
        rating=payload.rating,
        current_interval=flashcard.interval_days,
        current_repetitions=flashcard.repetitions,
        current_ef=flashcard.ease_factor,
    )

    flashcard.interval_days = updated.interval_days
    flashcard.repetitions = updated.repetitions
    flashcard.ease_factor = updated.ease_factor
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
