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


# ── Métricas de uso ──────────────────────────────────────────────────────────

class UserMetric(BaseModel):
    """Dados de uso de um único usuário para a página de métricas admin."""
    id: str
    full_name: str
    email: EmailStr
    tier: str
    is_active: bool
    created_at: datetime
    total_sessions: int
    total_messages: int      # apenas mensagens do role=user
    total_reviews: int
    last_active: Optional[datetime]  # data da última mensagem ou review

    model_config = {"from_attributes": True}


class DailyActivity(BaseModel):
    """Atividade agregada de todos os usuários em um único dia."""
    date: str          # ISO 8601 (YYYY-MM-DD)
    messages: int
    sessions: int
    reviews: int


class AdminMetricsResponse(BaseModel):
    """Resposta completa do endpoint GET /admin/metrics."""
    period_days: int
    # KPIs gerais
    total_users: int
    active_users: int
    inactive_users: int
    new_users_period: int
    messages_period: int
    sessions_period: int
    reviews_period: int
    # Série temporal para gráfico
    daily_activity: list[DailyActivity]
    # Breakdown por usuário
    user_metrics: list[UserMetric]
