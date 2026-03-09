"""Provider Ollama - LLM local/gratuito via Ollama."""

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
    ReadingActivity,
    ReadingQuestion,
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

    async def _repair_json_response(self, broken_text: str, timeout_seconds: int = 20) -> dict:
        prompt = (
            "Fix the malformed JSON below and return ONLY valid JSON. "
            "Do not add explanations. Preserve the original meaning and fields.\n"
            f"Broken JSON:\n{broken_text}"
        )
        repaired = await self._generate(prompt, timeout_seconds)
        return extract_json_object(repaired)

    async def _extract_json_with_repair(self, text: str) -> dict:
        try:
            return extract_json_object(text)
        except json.JSONDecodeError as exc:
            logger.warning("Ollama returned malformed JSON, attempting repair: %s", exc)
            try:
                return await self._repair_json_response(text)
            except Exception as repair_exc:
                logger.warning("Ollama JSON repair failed: %s", repair_exc)
                raise exc from repair_exc

    async def _generate_stream(self, prompt: str, timeout_seconds: int = 60) -> AsyncGenerator[str, None]:
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
            'correction_categories (array of short Portuguese error category strings, e.g. ["tempo verbal", "preposição"]).\n'
            f"Input: {raw_text}"
        )
        text = await self._generate(prompt, settings.correction_timeout_seconds)
        parsed = await self._extract_json_with_repair(text)

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
            '] }\n'
            f"Sentence: {sentence_en}"
        )
        text = await self._generate(prompt, settings.analysis_timeout_seconds)
        try:
            parsed = await self._extract_json_with_repair(text)
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

    async def generate_reading_activity(self, theme: str, context: dict) -> tuple[ReadingActivity, str]:
        model = settings.ollama_model
        learner_name = str(context.get("learner_name") or "Learner").strip()
        cefr_level = str(context.get("cefr_level") or "B1").strip() or "B1"
        question_language = str(context.get("question_language") or "en").strip().lower() or "en"
        question_language_name = "Portuguese" if question_language == "pt" else "English"
        prompt = (
            "Create an English reading-comprehension activity for a Brazilian learner. "
            "Return ONLY valid JSON with keys: title, theme, passage, questions. "
            "The passage must be in English with 2 to 4 short paragraphs, appropriate for the requested CEFR level. "
            "questions must contain exactly 4 items. Each item must have: question, options, correct_option, explanation. "
            "options must contain exactly 4 short answer choices in the selected question language. correct_option must exactly match one option. "
            "The questions should test main idea, detail, inference, and vocabulary in context. "
            "Keep the passage in English, but write the questions, options, correct_option, and explanation in the selected question language. "
            "Do not use markdown.\n"
            f"Theme: {theme}\nCEFR level: {cefr_level}\nLearner name: {learner_name}\nQuestion language: {question_language_name}"
        )
        text = await self._generate(prompt, settings.chat_timeout_seconds)
        parsed = await self._extract_json_with_repair(text)

        questions_payload = parsed.get("questions") or []
        questions: list[ReadingQuestion] = []
        for item in questions_payload:
            if not isinstance(item, dict):
                continue
            options = [str(option).strip() for option in (item.get("options") or []) if str(option).strip()]
            correct_option = str(item.get("correct_option") or "").strip()
            if len(options) != 4:
                continue
            if correct_option not in options:
                correct_option = options[0]
            questions.append(
                ReadingQuestion(
                    question=str(item.get("question") or "").strip(),
                    options=options,
                    correct_option=correct_option,
                    explanation=str(item.get("explanation") or "").strip(),
                )
            )

        if len(questions) < 4:
            raise ProviderRequestError("Ollama returned incomplete reading activity")

        return (
            ReadingActivity(
                title=str(parsed.get("title") or f"Reading about {theme}").strip(),
                theme=str(parsed.get("theme") or theme).strip(),
                passage=str(parsed.get("passage") or "").strip(),
                question_language=question_language,
                questions=questions[:4],
            ),
            model,
        )


