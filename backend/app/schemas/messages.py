from datetime import datetime

from pydantic import BaseModel


class MessageResponse(BaseModel):
    id: str
    role: str
    content_raw: str | None
    content_corrected: str | None
    content_final: str
    provider: str | None
    model: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
