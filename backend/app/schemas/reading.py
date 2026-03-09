from pydantic import BaseModel, Field


class ReadingGenerateRequest(BaseModel):
    theme: str = Field(min_length=2, max_length=120)
    cefr_level: str | None = Field(default="B1", max_length=4)
    question_language: str = Field(default="en", pattern="^(en|pt)$")
    provider_override: str | None = None


class ReadingQuestionResponse(BaseModel):
    question: str
    options: list[str]
    correct_option: str
    explanation: str


class ReadingGenerateResponse(BaseModel):
    title: str
    theme: str
    passage: str
    question_language: str
    questions: list[ReadingQuestionResponse]
    provider_used: str
    model_used: str


class ReadingAttemptCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    theme: str = Field(min_length=2, max_length=120)
    question_language: str = Field(default="en", pattern="^(en|pt)$")
    total_questions: int = Field(ge=1, le=20)
    correct_answers: int = Field(ge=0, le=20)


class ReadingAttemptResponse(BaseModel):
    id: str
    title: str
    theme: str
    question_language: str
    total_questions: int
    correct_answers: int
    accuracy_rate: float
    completed_at: str


class DailyReadingStat(BaseModel):
    date: str
    count: int
    accuracy: float


class ReadingProgressOverview(BaseModel):
    completed_activities: int
    total_questions_answered: int
    correct_answers: int
    accuracy_rate: float
    activities_today: int
    daily_history: list[DailyReadingStat]
