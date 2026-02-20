import asyncio
import os
from typing import AsyncGenerator

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_ai_mentor.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-access-secret")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "test-refresh-secret")
os.environ.setdefault("DEFAULT_AI_PROVIDER", "gemini")

from app.api.deps import get_llm_router
from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.services.llm_types import ChatResult, CorrectionResult, SentenceAnalysis, TokenAnalysis


class FakeLLMRouter:
    def available_provider_names(self) -> list[str]:
        return ["gemini"]



    async def correct_input(self, raw_text: str, context: dict, provider_override: str | None, user_preference: str | None):
        return (
            CorrectionResult(
                corrected_text="I think we need to go now",
                changed=True,
                notes="Correção aplicada",
            ),
            "gemini",
            "fake-correction-model",
        )

    async def generate_reply(self, corrected_text: str, history: list[dict], context: dict, provider_override: str | None, user_preference: str | None):
        return (
            ChatResult(reply="Great point. Where do you want to go now?"),
            "gemini",
            "fake-chat-model",
        )

    async def analyze_sentence(self, sentence_en: str, context: dict, provider_override: str | None, user_preference: str | None):
        return (
            SentenceAnalysis(
                original_en=sentence_en,
                translation_pt="Ótimo ponto. Para onde você quer ir agora?",
                tokens=[
                    TokenAnalysis(
                        token="Great",
                        lemma="great",
                        pos="adjective",
                        translation="ótimo",
                        definition="algo muito bom",
                    ),
                    TokenAnalysis(
                        token="point",
                        lemma="point",
                        pos="noun",
                        translation="ponto",
                        definition="ideia principal",
                    ),
                ],
            ),
            "gemini",
            "fake-analysis-model",
        )


async def _reset_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture()
def client() -> AsyncGenerator[TestClient, None]:
    asyncio.run(_reset_db())
    app.dependency_overrides[get_llm_router] = lambda: FakeLLMRouter()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
