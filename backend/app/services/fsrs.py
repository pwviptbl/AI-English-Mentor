"""Algoritmo FSRS v4 (Free Spaced Repetition Scheduler).

Baseado na especificação de Jarrett Ye (2022) — mais preciso que SM-2 para
prever o momento em que o estudante vai esquecer a palavra.

Referência: https://github.com/open-spaced-repetition/fsrs4anki/wiki/Algorithm
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

# --------------------------------------------------------------------- #
# Constantes do FSRS v4 (pesos padrão calibrados)
# --------------------------------------------------------------------- #
W = [
    0.4072,  # w0: estabilidade inicial — again
    1.1829,  # w1: estabilidade inicial — hard
    3.1262,  # w2: estabilidade inicial — good
    7.2102,  # w3: estabilidade inicial — easy
    7.2949,  # w4
    0.5316,  # w5
    1.0651,  # w6
    0.0589,  # w7: fator de decaimento da dificuldade
    1.5330,  # w8
    0.1544,  # w9
    1.0000,  # w10: multiplicador hard
    1.9813,  # w11: multiplicador good
    0.1100,  # w12: multiplicador easy
    0.2900,  # w13
    2.2700,  # w14
    0.4700,  # w15
    2.9898,  # w16: retriveability base
    0.2000,  # w17: fator de recall
]

DECAY = -0.5
FACTOR = (0.9 ** (1.0 / DECAY)) - 1.0  # ≈ 19.0

RATING_MAP = {
    "again": 1,
    "hard": 2,
    "good": 3,
    "easy": 4,
}


@dataclass(slots=True)
class FSRSResult:
    interval_days: int
    repetitions: int
    stability: float   # dias aproximados para 90% de retenção
    difficulty: float  # escala 1–10; 5 = médio
    ease_factor: float  # mantido por compatibilidade com o schema existente
    next_review: datetime
    lapses_increment: int


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _initial_stability(rating: int) -> float:
    """Estabilidade inicial para a primeira revisão (sem histórico)."""
    return W[rating - 1]  # w0=again, w1=hard, w2=good, w3=easy


def _initial_difficulty(rating: int) -> float:
    """Dificuldade inicial baseada no rating da primeira revisão."""
    d = W[4] - (rating - 3) * W[5]
    return _clamp(d, 1.0, 10.0)


def _next_difficulty(difficulty: float, rating: int) -> float:
    """Ajusta a dificuldade com base no desempenho atual."""
    delta = -W[6] * (rating - 3)
    d = difficulty + delta * ((10.0 - difficulty) / 9.0)
    # mean-reversion para 5
    d = W[7] * 5.0 + (1.0 - W[7]) * d
    return _clamp(d, 1.0, 10.0)


def _short_term_stability(stability: float, rating: int) -> float:
    """Atualização de estabilidade para revisões de reaprendizado (lapso)."""
    return stability * math.exp(W[17] * (rating - 3 + W[16]))


def _next_stability_recall(difficulty: float, stability: float, retrievability: float, rating: int) -> float:
    """Calcula nova estabilidade após revisão bem-sucedida."""
    hard_penalty = W[15] if rating == 2 else 1.0
    easy_bonus = W[16] if rating == 4 else 1.0
    s = stability * (
        math.exp(W[8])
        * (11.0 - difficulty)
        * (stability ** (-W[9]))
        * (math.exp(W[10] * (1.0 - retrievability)) - 1.0)
        * hard_penalty
        * easy_bonus
    )
    return max(s, 0.01)


def _retrievability(stability: float, elapsed_days: int) -> float:
    """Probabilidade de lembrar a palavra após `elapsed_days` dias."""
    return (1.0 + FACTOR * elapsed_days / stability) ** DECAY


def _interval_from_stability(stability: float, desired_retention: float = 0.90) -> int:
    """Calcula o intervalo em dias para atingir a retenção desejada."""
    interval = stability / FACTOR * (desired_retention ** (1.0 / DECAY) - 1.0)
    return max(1, round(interval))


def apply_fsrs(
    rating: str,
    current_interval: int,
    current_repetitions: int,
    current_ef: float,
    stability: float = 0.0,
    difficulty: float = 5.0,
) -> FSRSResult:
    """Aplica o algoritmo FSRS v4 e retorna o próximo estado do flashcard.

    Parâmetros:
        rating: "again" | "hard" | "good" | "easy"
        current_interval: intervalo atual em dias
        current_repetitions: quantas vezes já foi revisado com sucesso
        current_ef: ease factor do SM-2 (mantido por retrocompatibilidade)
        stability: parâmetro FSRS — dias para 90% retenção
        difficulty: parâmetro FSRS — 1.0 (fácil) a 10.0 (difícil)
    """
    if rating not in RATING_MAP:
        raise ValueError("rating inválido")

    r = RATING_MAP[rating]
    lapses_increment = 0

    # -- Primeiro review (sem histórico FSRS) --
    if stability < 0.1 or current_repetitions == 0:
        new_stability = _initial_stability(r)
        new_difficulty = _initial_difficulty(r)
        new_repetitions = 0 if r == 1 else 1
        if r == 1:
            lapses_increment = 1
        new_interval = _interval_from_stability(new_stability)
    else:
        new_difficulty = _next_difficulty(difficulty, r)
        elapsed = max(current_interval, 1)
        ret = _retrievability(stability, elapsed)

        if r == 1:
            # Lapso: reaprendizado
            lapses_increment = 1
            new_repetitions = 0
            new_stability = _short_term_stability(stability, r)
            new_interval = 1
        else:
            # Revisão bem-sucedida
            new_repetitions = current_repetitions + 1
            new_stability = _next_stability_recall(new_difficulty, stability, ret, r)
            new_interval = _interval_from_stability(new_stability)

    # ease_factor mantido para compatibilidade com campo existente no banco
    new_ef = _clamp(current_ef + (0.1 - (4 - r) * (0.08 + (4 - r) * 0.02)), 1.3, 3.0)

    next_review = datetime.now(UTC) + timedelta(days=new_interval)

    return FSRSResult(
        interval_days=new_interval,
        repetitions=new_repetitions,
        stability=round(new_stability, 4),
        difficulty=round(new_difficulty, 4),
        ease_factor=round(new_ef, 3),
        next_review=next_review,
        lapses_increment=lapses_increment,
    )
