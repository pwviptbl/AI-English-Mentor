import re
from urllib.parse import quote

import httpx

from app.core.logging import get_logger
from app.schemas.analysis import TokenInfo

logger = get_logger(__name__)

WORD_CLEAN_RE = re.compile(r"[^a-zA-Z'-]+")


def _normalize_word(word: str) -> str:
    cleaned = WORD_CLEAN_RE.sub("", word).strip().lower()
    return cleaned


class DictionaryLookupService:
    def __init__(self) -> None:
        self._cache: dict[str, TokenInfo] = {}

    async def _lookup_definition(self, word: str) -> tuple[str | None, str | None, str | None]:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{quote(word)}"
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                response = await client.get(url)
            if response.status_code != 200:
                return None, None, None

            payload = response.json()
            if not isinstance(payload, list) or not payload:
                return None, None, None

            entry = payload[0] if isinstance(payload[0], dict) else {}
            lemma = str(entry.get("word", "")).strip() or word
            meanings = entry.get("meanings") or []

            if not meanings or not isinstance(meanings, list):
                return lemma, None, None

            first_meaning = meanings[0] if isinstance(meanings[0], dict) else {}
            pos = str(first_meaning.get("partOfSpeech", "")).strip() or None
            definitions = first_meaning.get("definitions") or []
            if not definitions or not isinstance(definitions, list):
                return lemma, pos, None

            first_definition = definitions[0] if isinstance(definitions[0], dict) else {}
            definition = str(first_definition.get("definition", "")).strip() or None
            return lemma, pos, definition
        except Exception as exc:
            logger.warning("Dictionary definition lookup failed for '%s': %s", word, exc)
            return None, None, None

    async def _lookup_translation_pt(self, word: str) -> str | None:
        url = "https://api.mymemory.translated.net/get"
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                response = await client.get(url, params={"q": word, "langpair": "en|pt-BR"})
            if response.status_code != 200:
                return None

            payload = response.json()
            translation = (
                payload.get("responseData", {}).get("translatedText", "")
                if isinstance(payload, dict)
                else ""
            )
            translation = str(translation).strip()
            if not translation:
                return None
            return translation
        except Exception as exc:
            logger.warning("Dictionary translation lookup failed for '%s': %s", word, exc)
            return None

    async def lookup(self, word: str) -> TokenInfo:
        normalized = _normalize_word(word)
        if not normalized:
            return TokenInfo(token=word)

        if normalized in self._cache:
            return self._cache[normalized]

        lemma, pos, definition = await self._lookup_definition(normalized)
        translation = await self._lookup_translation_pt(normalized)

        token_info = TokenInfo(
            token=normalized,
            lemma=lemma,
            pos=pos,
            translation=translation,
            definition=definition,
        )
        self._cache[normalized] = token_info
        return token_info
