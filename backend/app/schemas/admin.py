from datetime import datetime
from typing import Optional

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
    tier: str | None = None
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


class UserMetric(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    tier: str
    is_active: bool
    created_at: datetime
    total_sessions: int
    total_messages: int
    total_reviews: int
    total_reading_activities: int
    total_reading_questions: int
    last_active: Optional[datetime]

    model_config = {"from_attributes": True}


class DailyActivity(BaseModel):
    date: str
    messages: int
    sessions: int
    reviews: int
    reading_activities: int


class AdminMetricsResponse(BaseModel):
    period_days: int
    total_users: int
    active_users: int
    inactive_users: int
    new_users_period: int
    messages_period: int
    sessions_period: int
    reviews_period: int
    reading_activities_period: int
    reading_questions_answered_period: int
    reading_correct_answers_period: int
    daily_activity: list[DailyActivity]
    user_metrics: list[UserMetric]
