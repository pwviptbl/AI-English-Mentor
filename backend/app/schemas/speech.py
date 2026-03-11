from pydantic import BaseModel, Field


class SpeechSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    rate: float = Field(default=1.0, ge=0.5, le=1.5)