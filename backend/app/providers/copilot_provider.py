import httpx

from app.core.config import settings
from app.providers.base import BaseLLMProvider
from app.providers.copilot_token_manager import CopilotTokenManager
from app.services.errors import ProviderRequestError, ProviderUnavailableError
from app.services.llm_types import (
    ChatResult,
    CorrectionResult,
    SentenceAnalysis,
    TokenAnalysis,
    extract_json_object,
)


class CopilotProvider(BaseLLMProvider):
    name = "copilot"

    def __init__(self, token_manager: CopilotTokenManager | None = None) -> None:
        self.token_manager = token_manager or CopilotTokenManager()

    def is_available(self) -> bool:
        if not settings.enable_copilot:
            return False
        # Disponível se tiver logado via OAuth OU se tiver um token interno válido em cache
        return self.token_manager.has_oauth_token() or self.token_manager._load_cached_internal_token() is not None

    async def _chat_completion(self, messages: list[dict], model: str, timeout_seconds: int) -> str:
        if not settings.enable_copilot:
            raise ProviderUnavailableError("copilot provider disabled")

        token = self.token_manager.get_internal_token()

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                "https://api.githubcopilot.com/chat/completions",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Copilot-Integration-Id": "vscode-chat",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.2,
                    "stream": False,
                },
            )

        if response.status_code == 401:
            token = self.token_manager.get_internal_token(force_refresh=True)
            async with httpx.AsyncClient(timeout=timeout_seconds) as client:
                response = await client.post(
                    "https://api.githubcopilot.com/chat/completions",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Copilot-Integration-Id": "vscode-chat",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": 0.2,
                        "stream": False,
                    },
                )

        if response.status_code != 200:
            raise ProviderRequestError(
                f"Copilot request failed status={response.status_code} body={response.text[:200]}"
            )

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise ProviderRequestError("Copilot returned no choices")

        message = choices[0].get("message", {})
        content = message.get("content", "")
        if not content:
            raise ProviderRequestError("Copilot returned empty message")
        return content.strip()

    async def correct_input(self, raw_text: str, context: dict) -> tuple[CorrectionResult, str]:
        model = settings.copilot_model_correction
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a strict English correction engine. Return only JSON with keys: "
                    "corrected_text (string), changed (boolean), notes (string in Portuguese), "
                    "correction_categories (array of short Portuguese error category names, e.g. "
                    "[\"tempo verbal\", \"preposição\", \"vocabulário\", \"gramática\"])."
                ),
            },
            {"role": "user", "content": raw_text},
        ]
        text = await self._chat_completion(messages, model, settings.correction_timeout_seconds)
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
        model = settings.copilot_model_chat
        persona = context.get("persona_prompt") or "You are an English conversation mentor."
        learner_name = str(context.get("learner_name") or "Learner").strip()
        system_prompt = (
            f"{persona} Reply in natural English only and be concise. "
            f"The learner name is {learner_name}; use it naturally when helpful."
        )
        messages = [{"role": "system", "content": system_prompt}]
        for item in history[-12:]:
            role = "assistant" if item.get("role") == "assistant" else "user"
            messages.append({"role": role, "content": item.get("content", "")})
        messages.append({"role": "user", "content": corrected_text})

        text = await self._chat_completion(messages, model, settings.chat_timeout_seconds)
        return ChatResult(reply=text), model

    async def analyze_sentence(self, sentence_en: str, context: dict) -> tuple[SentenceAnalysis, str]:
        model = settings.copilot_model_analysis
        messages = [
            {
                "role": "system",
                "content": (
                    "Return only JSON with original_en, translation_pt, and tokens[]. "
                    "Each token has token, lemma, pos, translation, definition."
                ),
            },
            {"role": "user", "content": sentence_en},
        ]
        text = await self._chat_completion(messages, model, settings.analysis_timeout_seconds)
        parsed = extract_json_object(text)

        tokens: list[TokenAnalysis] = []
        for item in parsed.get("tokens") or []:
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

        if not tokens:
            tokens = [TokenAnalysis(token=t) for t in sentence_en.split()]

        return (
            SentenceAnalysis(
                original_en=str(parsed.get("original_en", sentence_en)),
                translation_pt=str(parsed.get("translation_pt", "")),
                tokens=tokens,
            ),
            model,
        )
