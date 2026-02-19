from pydantic import BaseModel


class TokenInfo(BaseModel):
    token: str
    lemma: str | None = None
    pos: str | None = None
    translation: str | None = None
    definition: str | None = None


class MessageAnalysisResponse(BaseModel):
    original_en: str
    translation_pt: str
    tokens: list[TokenInfo]
