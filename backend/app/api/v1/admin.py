"""Endpoints administrativos — listagem de usuários, gestão de tier e limites."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.models import Flashcard, Message, ReviewLog, Session, TierLimits, User
from app.db.session import get_db
from app.schemas.admin import (
    AdminMetricsResponse,
    AdminUserListItem,
    AdminUserUpdate,
    DailyActivity,
    TierLimitsResponse,
    TierLimitsUpdate,
    UserMetric,
)
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_TIERS = {"free", "pro"}


@router.get("/users", response_model=list[AdminUserListItem], dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[AdminUserListItem]:
    """Lista todos os usuários (somente admin)."""
    users = (await db.execute(select(User).order_by(User.created_at.asc()))).scalars().all()
    return list(users)


@router.patch("/users/{user_id}", response_model=AdminUserListItem, dependencies=[Depends(require_admin)])
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminUserListItem:
    """Altera tier e/ou status admin de um usuário (somente admin)."""
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")

    # Impede que um admin remova seus próprios privilégios
    if target.id == current_user.id and payload.is_admin is False:
        raise HTTPException(status_code=400, detail="cannot remove your own admin privileges")

    if payload.tier is not None:
        if payload.tier not in VALID_TIERS:
            raise HTTPException(status_code=400, detail=f"tier must be one of {VALID_TIERS}")
        target.tier = payload.tier

    if payload.is_admin is not None:
        target.is_admin = payload.is_admin

    if payload.is_active is not None:
        target.is_active = payload.is_active

    await db.commit()
    await db.refresh(target)
    return target


@router.delete("/users/{user_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Exclui permanentemente um usuário (somente admin, não pode excluir a si mesmo)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot delete your own account")

    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")

    await db.delete(target)
    await db.commit()
    return Response(status_code=204)


@router.get("/tier-limits", response_model=list[TierLimitsResponse], dependencies=[Depends(require_admin)])
async def get_tier_limits(db: AsyncSession = Depends(get_db)) -> list[TierLimitsResponse]:
    """Retorna os limites diários configurados para cada tier."""
    rows = (await db.execute(select(TierLimits).order_by(TierLimits.tier))).scalars().all()
    return list(rows)


@router.put(
    "/tier-limits/{tier}",
    response_model=TierLimitsResponse,
    dependencies=[Depends(require_admin)],
)
async def update_tier_limits(
    tier: str,
    payload: TierLimitsUpdate,
    db: AsyncSession = Depends(get_db),
) -> TierLimitsResponse:
    """Atualiza os limites diários de um tier (somente admin)."""
    if tier not in VALID_TIERS:
        raise HTTPException(status_code=400, detail=f"tier must be one of {VALID_TIERS}")

    row = (await db.execute(select(TierLimits).where(TierLimits.tier == tier))).scalar_one_or_none()
    if not row:
        row = TierLimits(tier=tier)
        db.add(row)

    row.daily_chat_limit = max(0, payload.daily_chat_limit)
    row.daily_analysis_limit = max(0, payload.daily_analysis_limit)

    await db.commit()
    await db.refresh(row)

    # Invalida cache em memória
    from app.api.deps import invalidate_tier_limits_cache
    invalidate_tier_limits_cache()

    return row


@router.get("/metrics", response_model=AdminMetricsResponse, dependencies=[Depends(require_admin)])
async def get_metrics(
    days: int = Query(default=30, ge=1, le=90, description="Período em dias (1–90)"),
    db: AsyncSession = Depends(get_db),
) -> AdminMetricsResponse:
    """Retorna métricas de uso agregadas por período (somente admin)."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)

    # ── KPIs gerais ────────────────────────────────────────────────────────────
    all_users = (await db.execute(select(User))).scalars().all()
    total_users = len(all_users)
    active_users = sum(1 for u in all_users if u.is_active)
    inactive_users = total_users - active_users
    new_users_period = sum(1 for u in all_users if u.created_at >= cutoff)

    # Mensagens do usuário enviadas no período (exclui respostas do assistant)
    messages_period = (
        await db.execute(
            select(func.count(Message.id))
            .join(Session, Session.id == Message.session_id)
            .where(Message.role == "user", Message.created_at >= cutoff)
        )
    ).scalar_one()

    # Sessões criadas no período
    sessions_period = (
        await db.execute(
            select(func.count(Session.id)).where(Session.created_at >= cutoff)
        )
    ).scalar_one()

    # Reviews feitas no período
    reviews_period = (
        await db.execute(
            select(func.count(ReviewLog.id)).where(ReviewLog.reviewed_at >= cutoff)
        )
    ).scalar_one()

    # ── Atividade diária (série temporal para gráfico) ──────────────────────────────
    msg_rows = (
        await db.execute(
            select(Message.created_at)
            .join(Session, Session.id == Message.session_id)
            .where(Message.role == "user", Message.created_at >= cutoff)
        )
    ).scalars().all()

    sess_rows = (
        await db.execute(
            select(Session.created_at).where(Session.created_at >= cutoff)
        )
    ).scalars().all()

    rev_rows = (
        await db.execute(
            select(ReviewLog.reviewed_at).where(ReviewLog.reviewed_at >= cutoff)
        )
    ).scalars().all()

    # Agrega por data
    daily: dict[str, dict] = {}
    for dt in msg_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0})["messages"] += 1
    for dt in sess_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0})["sessions"] += 1
    for dt in rev_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0})["reviews"] += 1

    daily_activity = [
        DailyActivity(date=k, **daily[k])
        for k in sorted(daily.keys())
    ]

    # ── Breakdown por usuário ────────────────────────────────────────────────────────
    user_metrics: list[UserMetric] = []
    for user in all_users:
        # Conta sessões deste usuário
        u_sessions = (
            await db.execute(
                select(func.count(Session.id)).where(Session.user_id == user.id)
            )
        ).scalar_one()

        # Conta mensagens (role=user) deste usuário
        u_messages = (
            await db.execute(
                select(func.count(Message.id))
                .join(Session, Session.id == Message.session_id)
                .where(Session.user_id == user.id, Message.role == "user")
            )
        ).scalar_one()

        # Conta reviews deste usuário
        u_reviews = (
            await db.execute(
                select(func.count(ReviewLog.id))
                .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
                .where(Flashcard.user_id == user.id)
            )
        ).scalar_one()

        # Última atividade: a data mais recente entre última mensagem e último review
        last_msg_dt = (
            await db.execute(
                select(func.max(Message.created_at))
                .join(Session, Session.id == Message.session_id)
                .where(Session.user_id == user.id, Message.role == "user")
            )
        ).scalar_one()

        last_rev_dt = (
            await db.execute(
                select(func.max(ReviewLog.reviewed_at))
                .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
                .where(Flashcard.user_id == user.id)
            )
        ).scalar_one()

        # Determina o último acesso (max das duas datas, tratando None)
        candidates = [d for d in [last_msg_dt, last_rev_dt] if d is not None]
        last_active = max(candidates) if candidates else None

        user_metrics.append(UserMetric(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            tier=user.tier,
            is_active=user.is_active,
            created_at=user.created_at,
            total_sessions=int(u_sessions),
            total_messages=int(u_messages),
            total_reviews=int(u_reviews),
            last_active=last_active,
        ))

    # Ordena por última atividade: usuários com acesso mais recente primeiro
    user_metrics.sort(
        key=lambda x: x.last_active or datetime.min.replace(tzinfo=UTC),
        reverse=True,
    )

    return AdminMetricsResponse(
        period_days=days,
        total_users=total_users,
        active_users=active_users,
        inactive_users=inactive_users,
        new_users_period=new_users_period,
        messages_period=int(messages_period),
        sessions_period=int(sessions_period),
        reviews_period=int(reviews_period),
        daily_activity=daily_activity,
        user_metrics=user_metrics,
    )
