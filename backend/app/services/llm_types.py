import json
import re
from dataclasses import dataclass


@dataclass(slots=True)
class CorrectionResult:
    corrected_text: str
    changed: bool
    notes: str
    # categorias estruturadas do erro (ex: ["tempo verbal", "preposição"])
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


JSON_PATTERN = re.compile(r"\{.*\}", re.DOTALL)


def extract_json_object(text: str) -> dict:
    candidate = text.strip()
    # Remove blocos de código markdown (```json ... ```)
    if "```" in candidate:
        # Tenta remover a primeira ocorrência de ```json (ou só ```) e a última ```
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate, flags=re.MULTILINE)
        candidate = re.sub(r"\s*```$", "", candidate, flags=re.MULTILINE)
    
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Fallback: tenta encontrar o primeiro objeto JSON com regex
        match = JSON_PATTERN.search(candidate)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        raise

