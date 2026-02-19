import json
import re
from dataclasses import dataclass


@dataclass(slots=True)
class CorrectionResult:
    corrected_text: str
    changed: bool
    notes: str


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


JSON_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def extract_json_object(text: str) -> dict:
    candidate = text.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        match = JSON_PATTERN.search(candidate)
        if not match:
            raise
        return json.loads(match.group(0))
