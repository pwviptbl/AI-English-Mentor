from app.api.deps import get_llm_router
from app.main import app
from app.providers.base import BaseLLMProvider
from app.services.errors import ProviderRequestError
from app.services.llm_router import LLMRouter
from app.services.llm_types import ChatResult, CorrectionResult, SentenceAnalysis, TokenAnalysis


class BrokenPrimaryProvider(BaseLLMProvider):
    name = "gemini"

    def is_available(self) -> bool:
        return True

    async def correct_input(self, raw_text: str, context: dict):
        raise ProviderRequestError("primary correction failed")

    async def generate_reply(self, corrected_text: str, history: list[dict], context: dict):
        raise ProviderRequestError("primary chat failed")

    async def analyze_sentence(self, sentence_en: str, context: dict):
        raise ProviderRequestError("primary analysis failed")


class HealthyFallbackProvider(BaseLLMProvider):
    name = "copilot"

    def is_available(self) -> bool:
        return True

    async def correct_input(self, raw_text: str, context: dict):
        return CorrectionResult(corrected_text="Fallback corrected", changed=True, notes="ok"), "fallback-model"

    async def generate_reply(self, corrected_text: str, history: list[dict], context: dict):
        return ChatResult(reply="Fallback assistant reply"), "fallback-model"

    async def analyze_sentence(self, sentence_en: str, context: dict):
        return (
            SentenceAnalysis(
                original_en=sentence_en,
                translation_pt="Fallback",
                tokens=[TokenAnalysis(token="Fallback")],
            ),
            "fallback-model",
        )


def _auth_headers(client, email: str = "fallback@example.com", password: str = "secret1234") -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Fallback User", "email": email, "password": password},
    )
    login_response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_chat_fallback_between_providers(client) -> None:
    fallback_router = LLMRouter(
        providers={
            "gemini": BrokenPrimaryProvider(),
            "copilot": HealthyFallbackProvider(),
        }
    )
    app.dependency_overrides[get_llm_router] = lambda: fallback_router

    headers = _auth_headers(client)

    session_response = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"topic": "Fallback test", "persona_prompt": "Test"},
    )
    session_id = session_response.json()["id"]

    chat_response = client.post(
        "/api/v1/chat/send",
        headers=headers,
        json={"session_id": session_id, "text_raw": "texto de teste"},
    )

    assert chat_response.status_code == 200
    payload = chat_response.json()
    assert payload["corrected_text"] == "Fallback corrected"
    assert payload["assistant_reply"] == "Fallback assistant reply"
    assert payload["provider_used"] == "copilot"
