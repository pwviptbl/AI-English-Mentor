from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=120)
    persona_prompt: str | None = None
    cefr_level: str | None = None


class SessionUpdate(BaseModel):
    topic: str | None = Field(default=None, min_length=1, max_length=120)
    persona_prompt: str | None = None
    cefr_level: str | None = None


class SessionResponse(BaseModel):
    id: str
    topic: str
    persona_prompt: str | None
    cefr_level: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
