import json
import re
from dataclasses import dataclass


@dataclass(slots=True)
class CorrectionResult:
    corrected_text: str
    changed: bool
    notes: str
    correction_categories: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.correction_categories is None:
            self.correction_categories = []


@dataclass(slots=True)
class ChatResult:
    reply: str


@dataclass(slots=True)
class TokenAnalysis:
    token: str
    lemma: str | None = None
    pos: str | None = None
    translation: str | None = None
    definition: str | None = None


@dataclass(slots=True)
class SentenceAnalysis:
    original_en: str
    translation_pt: str
    tokens: list[TokenAnalysis]


@dataclass(slots=True)
class ReadingQuestion:
    question: str
    options: list[str]
    correct_option: str
    explanation_pt: str


@dataclass(slots=True)
class ReadingActivity:
    title: str
    theme: str
    passage: str
    questions: list[ReadingQuestion]


JSON_PATTERN = re.compile(r"\{.*\}", re.DOTALL)
TRAILING_COMMA_PATTERN = re.compile(r",\s*([}\]])")
SMART_QUOTES = str.maketrans({
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
})


def _strip_markdown_fence(text: str) -> str:
    candidate = text.strip()
    if "```" in candidate:
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate, flags=re.MULTILINE)
        candidate = re.sub(r"\s*```$", "", candidate, flags=re.MULTILINE)
    return candidate.strip()


def _repair_json_candidate(text: str) -> str:
    candidate = _strip_markdown_fence(text)
    candidate = candidate.translate(SMART_QUOTES)
    candidate = TRAILING_COMMA_PATTERN.sub(r"\1", candidate)
    return candidate.strip()


def extract_json_object(text: str) -> dict:
    candidate = _repair_json_candidate(text)

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        match = JSON_PATTERN.search(candidate)
        if match:
            fragment = _repair_json_candidate(match.group(0))
            try:
                return json.loads(fragment)
            except json.JSONDecodeError:
                pass
        raise
