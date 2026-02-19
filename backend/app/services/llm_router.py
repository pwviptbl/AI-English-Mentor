from app.core.config import settings
from app.core.logging import get_logger
from app.providers.base import BaseLLMProvider
from app.providers.copilot_provider import CopilotProvider
from app.providers.gemini_provider import GeminiProvider
from app.services.errors import ProviderError, ProviderUnavailableError
from app.services.llm_types import ChatResult, CorrectionResult, SentenceAnalysis

logger = get_logger(__name__)


class LLMRouter:
    def __init__(self, providers: dict[str, BaseLLMProvider] | None = None) -> None:
        self.providers: dict[str, BaseLLMProvider] = providers or {
            "gemini": GeminiProvider(),
            "copilot": CopilotProvider(),
        }

    def available_provider_names(self) -> list[str]:
        names = []
        for name, provider in self.providers.items():
            if provider.is_available() or name == "gemini":
                names.append(name)
        return names

    def copilot_authenticated(self) -> bool:
        provider = self.providers.get("copilot")
        if not provider:
            return False
        return provider.is_available()

    def _provider_order(self, provider_override: str | None, user_preference: str | None) -> list[str]:
        candidates: list[str] = []

        if provider_override and provider_override in self.providers:
            candidates.append(provider_override)

        if user_preference and user_preference in self.providers and user_preference not in candidates:
            candidates.append(user_preference)

        default = settings.default_ai_provider
        if default in self.providers and default not in candidates:
            candidates.append(default)

        for name in self.providers:
            if name not in candidates:
                candidates.append(name)

        return candidates

    async def _execute_with_fallback(self, method_name: str, order: list[str], *args, **kwargs):
        errors: list[str] = []

        def fmt_exc(exc: Exception) -> str:
            message = str(exc).strip()
            if message:
                return f"{exc.__class__.__name__}: {message}"
            return exc.__class__.__name__

        for index, provider_name in enumerate(order):
            provider = self.providers[provider_name]
            if not provider.is_available() and provider_name != "gemini":
                errors.append(f"{provider_name}: unavailable")
                continue

            max_attempts = 2 if index == 0 else 1
            for attempt in range(max_attempts):
                try:
                    method = getattr(provider, method_name)
                    result, model = await method(*args, **kwargs)
                    return result, provider_name, model
                except ProviderError as exc:
                    errors.append(f"{provider_name} attempt {attempt + 1}: {fmt_exc(exc)}")
                    logger.warning(
                        "Provider %s failed on %s attempt %s: %s",
                        provider_name,
                        method_name,
                        attempt + 1,
                        exc,
                    )
                except Exception as exc:
                    errors.append(f"{provider_name} attempt {attempt + 1}: {fmt_exc(exc)}")
                    logger.exception(
                        "Unexpected provider error provider=%s method=%s attempt=%s",
                        provider_name,
                        method_name,
                        attempt + 1,
                    )

        details = " | ".join(errors) if errors else "no provider attempted"
        raise ProviderError(f"all providers failed for {method_name}: {details}")

    async def correct_input(
        self,
        raw_text: str,
        context: dict,
        provider_override: str | None,
        user_preference: str | None,
    ) -> tuple[CorrectionResult, str, str]:
        order = self._provider_order(provider_override, user_preference)
        result, provider_name, model = await self._execute_with_fallback(
            "correct_input", order, raw_text, context
        )
        return result, provider_name, model

    async def generate_reply(
        self,
        corrected_text: str,
        history: list[dict],
        context: dict,
        provider_override: str | None,
        user_preference: str | None,
    ) -> tuple[ChatResult, str, str]:
        order = self._provider_order(provider_override, user_preference)
        result, provider_name, model = await self._execute_with_fallback(
            "generate_reply",
            order,
            corrected_text,
            history,
            context,
        )
        return result, provider_name, model

    async def analyze_sentence(
        self,
        sentence_en: str,
        context: dict,
        provider_override: str | None,
        user_preference: str | None,
    ) -> tuple[SentenceAnalysis, str, str]:
        order = self._provider_order(provider_override, user_preference)
        result, provider_name, model = await self._execute_with_fallback(
            "analyze_sentence", order, sentence_en, context
        )
        return result, provider_name, model
