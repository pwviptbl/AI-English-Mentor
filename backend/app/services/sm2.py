from dataclasses import dataclass
from datetime import UTC, datetime, timedelta


RATING_MAP = {
    "again": 0,
    "hard": 3,
    "good": 4,
    "easy": 5,
}


@dataclass(slots=True)
class SM2Result:
    interval_days: int
    repetitions: int
    ease_factor: float
    next_review: datetime
    lapses_increment: int


def apply_sm2(
    rating: str,
    current_interval: int,
    current_repetitions: int,
    current_ef: float,
) -> SM2Result:
    if rating not in RATING_MAP:
        raise ValueError("invalid rating")

    quality = RATING_MAP[rating]
    interval = current_interval
    repetitions = current_repetitions
    ease_factor = current_ef
    lapses_increment = 0

    if quality < 3:
        repetitions = 0
        interval = 1
        lapses_increment = 1
    else:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = round(interval * ease_factor)
        repetitions += 1

    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease_factor = max(1.3, ease_factor)

    next_review = datetime.now(UTC) + timedelta(days=interval)

    return SM2Result(
        interval_days=interval,
        repetitions=repetitions,
        ease_factor=round(ease_factor, 3),
        next_review=next_review,
        lapses_increment=lapses_increment,
    )
