from pydantic import BaseModel, Field


class ChatSendRequest(BaseModel):
    session_id: str
    text_raw: str = Field(min_length=1, max_length=4000)
    provider_override: str | None = None


class ChatSendResponse(BaseModel):
    user_message_id: str
    corrected_text: str
    correction_meta: dict
    assistant_message_id: str
    assistant_reply: str
    provider_used: str
    model_used: str
    latency_ms: int
