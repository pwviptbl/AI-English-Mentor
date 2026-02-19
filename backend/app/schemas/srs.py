from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FlashcardCreate(BaseModel):
    word: str = Field(min_length=1, max_length=120)
    lemma: str | None = Field(default=None, max_length=120)
    pos: str | None = Field(default=None, max_length=32)
    translation: str | None = Field(default=None, max_length=240)
    definition: str | None = None
    context_sentence: str | None = None


class FlashcardResponse(BaseModel):
    id: str
    word: str
    lemma: str | None
    pos: str | None
    translation: str | None
    definition: str | None
    context_sentence: str | None
    next_review: datetime
    interval_days: int
    repetitions: int
    ease_factor: float
    lapses: int
    # campos FSRS v4
    stability: float = 0.0
    difficulty: float = 5.0

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    flashcard_id: str
    rating: Literal["again", "hard", "good", "easy"]


class ReviewResponse(BaseModel):
    flashcard_id: str
    rating: str
    next_review: datetime
    interval_days: int
    repetitions: int
    ease_factor: float
    stability: float = 0.0
    difficulty: float = 5.0


class ReviewStatsResponse(BaseModel):
    total_cards: int
    due_now: int
    reviews_today: int


class DailyReviewStat(BaseModel):
    date: str  # formato YYYY-MM-DD
    count: int
    accuracy: float  # proporção de good+easy / total


class ProgressOverview(BaseModel):
    streak_days: int
    total_learned: int  # cards com repetitions >= 2
    accuracy_rate: float  # global: good+easy / total reviews
    reviews_today: int
    daily_history: list[DailyReviewStat]
