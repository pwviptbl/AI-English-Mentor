from pydantic import BaseModel


class ProviderStatusResponse(BaseModel):
    default_provider: str
    available_providers: list[str]


class ProviderPreferenceUpdate(BaseModel):
    preferred_ai_provider: str
