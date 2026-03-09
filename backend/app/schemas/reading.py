from pydantic import BaseModel, Field


class ReadingGenerateRequest(BaseModel):
    theme: str = Field(min_length=2, max_length=120)
    cefr_level: str | None = Field(default="B1", max_length=4)
    provider_override: str | None = None


class ReadingQuestionResponse(BaseModel):
    question: str
    options: list[str]
    correct_option: str
    explanation_pt: str


class ReadingGenerateResponse(BaseModel):
    title: str
    theme: str
    passage: str
    questions: list[ReadingQuestionResponse]
    provider_used: str
    model_used: str
