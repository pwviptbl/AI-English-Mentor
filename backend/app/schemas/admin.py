from datetime import datetime

from pydantic import BaseModel, EmailStr


class AdminUserListItem(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    tier: str
    is_admin: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    tier: str | None = None        # "free" | "pro"
    is_admin: bool | None = None
    is_active: bool | None = None


class TierLimitsResponse(BaseModel):
    tier: str
    daily_chat_limit: int
    daily_analysis_limit: int

    model_config = {"from_attributes": True}


class TierLimitsUpdate(BaseModel):
    daily_chat_limit: int
    daily_analysis_limit: int


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None
