import json
import re

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.providers.base import BaseLLMProvider
from app.services.errors import ProviderRequestError, ProviderUnavailableError
from app.services.llm_types import (
    ChatResult,
    CorrectionResult,
    SentenceAnalysis,
    TokenAnalysis,
    extract_json_object,
)

logger = get_logger(__name__)


class GeminiProvider(BaseLLMProvider):
    name = "gemini"

    def is_available(self) -> bool:
        # Disponível apenas se a chave da API estiver configurada
        return bool(settings.gemini_api_key)

    async def _generate(self, prompt: str, model: str, timeout_seconds: int) -> str:
        if not settings.gemini_api_key:
            raise ProviderUnavailableError("GEMINI_API_KEY is not set")

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            f"?key={settings.gemini_api_key}"
        )

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2},
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(url, json=payload)
        except httpx.TimeoutException as exc:
            raise ProviderRequestError(f"Gemini timeout after {timeout_seconds}s") from exc
        except httpx.RequestError as exc:
            raise ProviderRequestError(f"Gemini request error: {exc.__class__.__name__}") from exc

        if response.status_code != 200:
            raise ProviderRequestError(
                f"Gemini request failed status={response.status_code} body={response.text[:200]}"
            )

        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise ProviderRequestError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
        text = "\n".join(t for t in texts if t).strip()
        if not text:
            raise ProviderRequestError("Gemini returned empty text")
        return text

    async def correct_input(self, raw_text: str, context: dict) -> tuple[CorrectionResult, str]:
        model = settings.gemini_model_correction
        prompt = (
            "You are a strict English correction engine. The input can be Portuguese, English, or mixed. "
            "Rewrite the user sentence in natural English while preserving intent and tone. "
            "Return ONLY valid JSON with keys: corrected_text (string), changed (boolean), notes (string), "
            "correction_categories (array of strings — error category names in Portuguese, e.g. "
            '["tempo verbal", "pronominal", "preposição", "vocabulário", "ortografia", "gramática"]).'
            "notes must be a concise explanation in Portuguese of each error found.\n"
            f"Input: {raw_text}"
        )
        text = await self._generate(prompt, model, settings.correction_timeout_seconds)
        parsed = extract_json_object(text)

        corrected_text = str(parsed.get("corrected_text", "")).strip() or raw_text.strip()
        changed = bool(parsed.get("changed", corrected_text != raw_text.strip()))
        notes = str(parsed.get("notes", ""))
        categories_raw = parsed.get("correction_categories") or []
        categories = [str(c) for c in categories_raw if c]
        return CorrectionResult(
            corrected_text=corrected_text,
            changed=changed,
            notes=notes,
            correction_categories=categories,
        ), model

    async def _translate_sentence_pt(self, sentence_en: str, model: str) -> str:
        prompt = (
            "Translate the following English sentence to Brazilian Portuguese. "
            "Return only the translated sentence without explanations.\n"
            f"Sentence: {sentence_en}"
        )
        try:
            translation = await self._generate(prompt, model, settings.analysis_timeout_seconds)
            return translation.strip()
        except Exception as exc:
            logger.warning("Gemini translation fallback failed: %s", exc)
            return ""

    async def generate_reply(
        self, corrected_text: str, history: list[dict], context: dict
    ) -> tuple[ChatResult, str]:
        model = settings.gemini_model_chat
        history_lines = []
        for item in history[-12:]:
            role = item.get("role", "user")
            content = item.get("content", "")
            history_lines.append(f"{role}: {content}")

        persona = context.get("persona_prompt") or (
            "You are an English conversation mentor. Respond only in English, naturally, and briefly."
        )
        learner_name = str(context.get("learner_name") or "Learner").strip()

        prompt = (
            f"System persona: {persona}\n"
            f"Learner name: {learner_name}\n"
            "Conversation history:\n"
            + "\n".join(history_lines)
            + "\n"
            f"Learner corrected input: {corrected_text}\n"
            "Task: Reply as a conversation partner in English. "
            "Use learner name naturally when it helps. Add one short follow-up question."
        )

        text = await self._generate(prompt, model, settings.chat_timeout_seconds)
        return ChatResult(reply=text.strip()), model

    async def stream_reply(
        self, corrected_text: str, history: list[dict], context: dict
    ):
        """Streaming da resposta do assistente via Gemini streamGenerateContent."""
        from collections.abc import AsyncGenerator  # import local para evitar ciclo

        if not settings.gemini_api_key:
            raise ProviderUnavailableError("GEMINI_API_KEY is not set")

        model = settings.gemini_model_chat
        history_lines = [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-12:]]
        persona = context.get("persona_prompt") or (
            "You are an English conversation mentor. Respond only in English, naturally, and briefly."
        )
        learner_name = str(context.get("learner_name") or "Learner").strip()
        prompt = (
            f"System persona: {persona}\nLearner name: {learner_name}\n"
            "Conversation history:\n" + "\n".join(history_lines) + "\n"
            f"Learner corrected input: {corrected_text}\n"
            "Reply as a conversation partner in English. Add one short follow-up question."
        )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent"
            f"?key={settings.gemini_api_key}&alt=sse"
        )
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2},
        }

        import httpx as _httpx
        try:
            async with _httpx.AsyncClient(timeout=settings.chat_timeout_seconds) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if not raw or raw == "[DONE]":
                            continue
                        try:
                            data = json.loads(raw)
                            candidates = data.get("candidates") or []
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    token = part.get("text", "")
                                    if token:
                                        yield token
                        except json.JSONDecodeError:
                            continue
        except _httpx.RequestError as exc:
            raise ProviderRequestError(f"Gemini stream error: {exc}") from exc

    async def analyze_sentence(self, sentence_en: str, context: dict) -> tuple[SentenceAnalysis, str]:
        model = settings.gemini_model_analysis
        prompt = (
            "You are an English tutor analyzer. Given one English sentence, return ONLY JSON with keys: "
            "original_en (string), translation_pt (string), tokens (array). "
            "Each token object must include: token, lemma, pos, translation, definition. "
            "Use Portuguese in translation and definition.\n"
            "Example output:\n"
            '{ "original_en": "Hello world", "translation_pt": "Olá mundo", "tokens": ['
            '{ "token": "Hello", "lemma": "hello", "pos": "interjection", "translation": "olá", "definition": "saudação" },'
            '{ "token": "world", "lemma": "world", "pos": "noun", "translation": "mundo", "definition": "planeta Terra" }'
            "] }\n"
            f"Sentence: {sentence_en}"
        )

        try:
            text = await self._generate(prompt, model, settings.analysis_timeout_seconds)
            parsed = extract_json_object(text)

            original_en = str(parsed.get("original_en") or sentence_en)
            translation_pt = str(parsed.get("translation_pt") or "").strip()
            tokens_payload = parsed.get("tokens") or []

            tokens: list[TokenAnalysis] = []
            for item in tokens_payload:
                if not isinstance(item, dict):
                    continue
                tokens.append(
                    TokenAnalysis(
                        token=str(item.get("token", "")).strip(),
                        lemma=(str(item.get("lemma")).strip() if item.get("lemma") else None),
                        pos=(str(item.get("pos")).strip() if item.get("pos") else None),
                        translation=(
                            str(item.get("translation")).strip() if item.get("translation") else None
                        ),
                        definition=(
                            str(item.get("definition")).strip() if item.get("definition") else None
                        ),
                    )
                )

            if not translation_pt:
                translation_pt = await self._translate_sentence_pt(original_en, model)

            if tokens:
                return (
                    SentenceAnalysis(
                        original_en=original_en,
                        translation_pt=translation_pt,
                        tokens=tokens,
                    ),
                    model,
                )
        except Exception as exc:
            logger.warning("Gemini analysis fallback activated: %s", exc)

        # Graceful fallback when analysis model returns malformed output or times out.
        raw_tokens = [tok.strip(".,!?;:\"'()") for tok in sentence_en.split() if tok.strip()]
        tokens = [TokenAnalysis(token=tok) for tok in raw_tokens]
        translation_pt = await self._translate_sentence_pt(sentence_en, model)
        return (
            SentenceAnalysis(
                original_en=sentence_en,
                translation_pt=translation_pt,
                tokens=tokens,
            ),
            model,
        )
