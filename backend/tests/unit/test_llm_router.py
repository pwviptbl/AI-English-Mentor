import pytest

from app.providers.base import BaseLLMProvider
from app.services.errors import ProviderRequestError
from app.services.llm_router import LLMRouter
from app.services.llm_types import ChatResult, CorrectionResult, SentenceAnalysis, TokenAnalysis


class FailingProvider(BaseLLMProvider):
    name = "failing"

    def is_available(self) -> bool:
        return True

    async def correct_input(self, raw_text: str, context: dict):
        raise ProviderRequestError("failed")

    async def generate_reply(self, corrected_text: str, history: list[dict], context: dict):
        raise ProviderRequestError("failed")

    async def analyze_sentence(self, sentence_en: str, context: dict):
        raise ProviderRequestError("failed")


class SuccessProvider(BaseLLMProvider):
    def __init__(self, name: str):
        self.name = name

    def is_available(self) -> bool:
        return True

    async def correct_input(self, raw_text: str, context: dict):
        return CorrectionResult(corrected_text="Fixed", changed=True, notes="ok"), "success-model"

    async def generate_reply(self, corrected_text: str, history: list[dict], context: dict):
        return ChatResult(reply="Reply"), "success-model"

    async def analyze_sentence(self, sentence_en: str, context: dict):
        return (
            SentenceAnalysis(
                original_en=sentence_en,
                translation_pt="Traducao",
                tokens=[TokenAnalysis(token="Reply")],
            ),
            "success-model",
        )


@pytest.mark.asyncio
async def test_llm_router_fallback_to_secondary_provider() -> None:
    router = LLMRouter(
        providers={
            "gemini": FailingProvider(),
            "secondary": SuccessProvider("secondary"),
        }
    )

    result, provider, model = await router.correct_input(
        raw_text="texto",
        context={},
        provider_override="gemini",
        user_preference="gemini",
    )

    assert result.corrected_text == "Fixed"
    assert provider == "secondary"
    assert model == "success-model"
