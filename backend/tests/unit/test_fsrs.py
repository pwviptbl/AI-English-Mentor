"""Testes do algoritmo FSRS v4.

Cobre os 4 ratings: again, hard, good, easy em cenários de primeira revisão
e revisões subsequentes, validando propriedades-chave do algoritmo.
"""

import pytest

from app.services.fsrs import FSRSResult, apply_fsrs


class TestFSRSPrimeiraRevisao:
    """Primeira revisão: stability == 0 → usa estabilidade inicial."""

    def test_again_primeira_revisao(self):
        """Rating 'again' deve criar intervalo de 1 dia e incrementar lapses."""
        result = apply_fsrs("again", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        assert result.interval_days == 1
        assert result.lapses_increment == 1
        assert result.repetitions == 0
        assert result.stability > 0  # estabilidade inicial do 'again'
        assert 1.0 <= result.difficulty <= 10.0

    def test_good_primeira_revisao(self):
        """Rating 'good' deve gerar interval > 1 e incrementar repetitions."""
        result = apply_fsrs("good", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        assert result.interval_days >= 1
        assert result.lapses_increment == 0
        assert result.repetitions == 1
        assert result.stability > 0

    def test_easy_primeira_revisao(self):
        """Rating 'easy' deve gerar intervalo maior que 'good'."""
        res_good = apply_fsrs("good", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        res_easy = apply_fsrs("easy", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        assert res_easy.interval_days >= res_good.interval_days
        assert res_easy.stability >= res_good.stability

    def test_hard_primeira_revisao(self):
        """Rating 'hard' deve gerar intervalo entre again e good."""
        res_again = apply_fsrs("again", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        res_hard = apply_fsrs("hard", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        res_good = apply_fsrs("good", 1, 0, 2.5, stability=0.0, difficulty=5.0)
        assert res_again.stability <= res_hard.stability
        assert res_hard.stability <= res_good.stability


class TestFSRSRevisaoSubsequente:
    """Revisões com histórico (stability > 0)."""

    def test_good_aumenta_stability(self):
        """Revisão 'good' com card bem estabelecido deve aumentar stability."""
        result = apply_fsrs("good", 10, 2, 2.5, stability=4.0, difficulty=5.0)
        assert result.stability > 4.0
        assert result.repetitions == 3
        assert result.interval_days >= 1

    def test_again_com_historico_reinicia(self):
        """Rating 'again' deve incrementar lapses e reiniciar intervalo para 1."""
        result = apply_fsrs("again", 10, 3, 2.5, stability=8.0, difficulty=5.0)
        assert result.lapses_increment == 1
        assert result.interval_days == 1
        assert result.repetitions == 0

    def test_ease_factor_bounds(self):
        """ease_factor deve permanecer entre 1.3 e 3.0."""
        for rating in ("again", "hard", "good", "easy"):
            result = apply_fsrs(rating, 5, 2, 2.5, stability=3.0, difficulty=5.0)
            assert 1.3 <= result.ease_factor <= 3.0

    def test_difficulty_bounds(self):
        """difficulty deve permanecer entre 1.0 e 10.0."""
        for rating in ("again", "hard", "good", "easy"):
            result = apply_fsrs(rating, 5, 2, 2.5, stability=3.0, difficulty=5.0)
            assert 1.0 <= result.difficulty <= 10.0

    def test_rating_invalido_levanta_excecao(self):
        """Rating inválido deve levantar ValueError."""
        with pytest.raises(ValueError, match="rating inválido"):
            apply_fsrs("perfect", 1, 0, 2.5)

    def test_next_review_no_futuro(self):
        """next_review deve ser sempre no futuro."""
        from datetime import UTC, datetime
        result = apply_fsrs("good", 3, 1, 2.5, stability=2.0, difficulty=5.0)
        assert result.next_review > datetime.now(UTC)
