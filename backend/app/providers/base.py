from abc import ABC, abstractmethod

from app.services.llm_types import ChatResult, CorrectionResult, SentenceAnalysis


class BaseLLMProvider(ABC):
    name: str

    @abstractmethod
    def is_available(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def correct_input(self, raw_text: str, context: dict) -> tuple[CorrectionResult, str]:
        raise NotImplementedError

    @abstractmethod
    async def generate_reply(
        self, corrected_text: str, history: list[dict], context: dict
    ) -> tuple[ChatResult, str]:
        raise NotImplementedError

    @abstractmethod
    async def analyze_sentence(self, sentence_en: str, context: dict) -> tuple[SentenceAnalysis, str]:
        raise NotImplementedError
