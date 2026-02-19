"""Provider Ollama — LLM local/gratuito via Ollama (http://localhost:11434).

Para usar:
1. Instale o Ollama: https://ollama.ai
2. Baixe um modelo: ``ollama pull llama3.2``
3. Defina no .env: ENABLE_OLLAMA=true, OLLAMA_MODEL=llama3.2
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator

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


class OllamaProvider(BaseLLMProvider):
    name = "ollama"

    def is_available(self) -> bool:
        return settings.enable_ollama

    async def _generate(self, prompt: str, timeout_seconds: int = 30) -> str:
        """Chama a API Ollama (endpoint /api/generate, modo não-streaming)."""
        if not settings.enable_ollama:
            raise ProviderUnavailableError("Ollama provider desabilitado (ENABLE_OLLAMA=false)")

        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(url, json=payload)
        except httpx.TimeoutException as exc:
            raise ProviderRequestError(f"Ollama timeout após {timeout_seconds}s") from exc
        except httpx.RequestError as exc:
            raise ProviderRequestError(f"Ollama não está rodando em {settings.ollama_base_url}: {exc}") from exc

        if response.status_code != 200:
            raise ProviderRequestError(
                f"Ollama retornou status={response.status_code} body={response.text[:200]}"
            )

        data = response.json()
        text = str(data.get("response", "")).strip()
        if not text:
            raise ProviderRequestError("Ollama retornou resposta vazia")
        return text

    async def _generate_stream(self, prompt: str, timeout_seconds: int = 60) -> AsyncGenerator[str, None]:
        """Chama a API Ollama em modo streaming."""
        if not settings.enable_ollama:
            raise ProviderUnavailableError("Ollama provider desabilitado")

        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.ollama_model,
            "prompt": prompt,
            "stream": True,
            "options": {"temperature": 0.2},
        }

        try:
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                            token = chunk.get("response", "")
                            if token:
                                yield token
                            if chunk.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except httpx.RequestError as exc:
            raise ProviderRequestError(f"Ollama stream error: {exc}") from exc

    async def correct_input(self, raw_text: str, context: dict) -> tuple[CorrectionResult, str]:
        model = settings.ollama_model
        prompt = (
            "You are a strict English correction engine. The input can be Portuguese, English, or mixed. "
            "Rewrite the user sentence in natural English while preserving intent and tone. "
            "Return ONLY valid JSON with keys: corrected_text (string), changed (boolean), notes (string in Portuguese), "
            "correction_categories (array of short Portuguese error category strings, e.g. [\"tempo verbal\", \"preposição\"]).\n"
            f"Input: {raw_text}"
        )
        text = await self._generate(prompt, settings.correction_timeout_seconds)
        parsed = extract_json_object(text)

        corrected = str(parsed.get("corrected_text", "")).strip() or raw_text.strip()
        changed = bool(parsed.get("changed", corrected != raw_text.strip()))
        notes = str(parsed.get("notes", ""))
        categories_raw = parsed.get("correction_categories") or []
        categories = [str(c) for c in categories_raw if c]
        return CorrectionResult(
            corrected_text=corrected,
            changed=changed,
            notes=notes,
            correction_categories=categories,
        ), model

    async def generate_reply(
        self, corrected_text: str, history: list[dict], context: dict
    ) -> tuple[ChatResult, str]:
        model = settings.ollama_model
        history_lines = [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-12:]]
        persona = context.get("persona_prompt") or "You are an English conversation mentor."
        learner_name = str(context.get("learner_name") or "Learner").strip()

        prompt = (
            f"System: {persona}\nLearner name: {learner_name}\n"
            "Conversation:\n" + "\n".join(history_lines) + "\n"
            f"Learner input: {corrected_text}\n"
            "Reply naturally in English and add one follow-up question. "
            "Do not include 'Assistant:' prefix."
        )
        text = await self._generate(prompt, settings.chat_timeout_seconds)
        return ChatResult(reply=text.strip()), model

    async def stream_reply(
        self, corrected_text: str, history: list[dict], context: dict
    ) -> AsyncGenerator[str, None]:
        """Versão streaming do generate_reply para Ollama."""
        history_lines = [f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-12:]]
        persona = context.get("persona_prompt") or "You are an English conversation mentor."
        learner_name = str(context.get("learner_name") or "Learner").strip()

        prompt = (
            f"System: {persona}\nLearner name: {learner_name}\n"
            "Conversation:\n" + "\n".join(history_lines) + "\n"
            f"Learner input: {corrected_text}\n"
            "Reply naturally in English and add one follow-up question."
        )
        async for chunk in self._generate_stream(prompt, settings.chat_timeout_seconds):
            yield chunk

    async def analyze_sentence(self, sentence_en: str, context: dict) -> tuple[SentenceAnalysis, str]:
        model = settings.ollama_model
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
        text = await self._generate(prompt, settings.analysis_timeout_seconds)
        try:
            parsed = extract_json_object(text)
            tokens = [
                TokenAnalysis(
                    token=str(t.get("token", "")).strip(),
                    lemma=str(t.get("lemma")).strip() if t.get("lemma") else None,
                    pos=str(t.get("pos")).strip() if t.get("pos") else None,
                    translation=str(t.get("translation")).strip() if t.get("translation") else None,
                    definition=str(t.get("definition")).strip() if t.get("definition") else None,
                )
                for t in (parsed.get("tokens") or [])
                if isinstance(t, dict)
            ]
            return SentenceAnalysis(
                original_en=str(parsed.get("original_en", sentence_en)),
                translation_pt=str(parsed.get("translation_pt", "")),
                tokens=tokens,
            ), model
        except Exception as exc:
            logger.warning("Ollama analyze_sentence fallback: %s", exc)
            tokens = [TokenAnalysis(token=tok.strip(".,!?;:\"'()")) for tok in sentence_en.split() if tok.strip()]
            return SentenceAnalysis(original_en=sentence_en, translation_pt="", tokens=tokens), model
