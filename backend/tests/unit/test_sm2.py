from app.services.sm2 import apply_sm2


def test_sm2_good_first_review() -> None:
    result = apply_sm2("good", current_interval=1, current_repetitions=0, current_ef=2.5)
    assert result.interval_days == 1
    assert result.repetitions == 1
    assert result.ease_factor >= 2.5


def test_sm2_again_resets_repetitions_and_increments_lapses() -> None:
    result = apply_sm2("again", current_interval=10, current_repetitions=4, current_ef=2.7)
    assert result.interval_days == 1
    assert result.repetitions == 0
    assert result.lapses_increment == 1
    assert result.ease_factor >= 1.3


def test_sm2_easy_grows_interval() -> None:
    result = apply_sm2("easy", current_interval=6, current_repetitions=2, current_ef=2.5)
    assert result.interval_days >= 10
    assert result.repetitions == 3
