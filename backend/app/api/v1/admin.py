"""Endpoints administrativos - listagem de usuarios, gestao de tier e limites."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.models import Flashcard, Message, ReadingAttempt, ReviewLog, Session, TierLimits, User
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

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_TIERS = {"free", "pro"}


@router.get("/users", response_model=list[AdminUserListItem], dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)) -> list[AdminUserListItem]:
    users = (await db.execute(select(User).order_by(User.created_at.asc()))).scalars().all()
    return list(users)


@router.patch("/users/{user_id}", response_model=AdminUserListItem, dependencies=[Depends(require_admin)])
async def update_user(
    user_id: str,
    payload: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdminUserListItem:
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="user not found")

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

    from app.api.deps import invalidate_tier_limits_cache

    invalidate_tier_limits_cache()

    return row


@router.get("/metrics", response_model=AdminMetricsResponse, dependencies=[Depends(require_admin)])
async def get_metrics(
    days: int = Query(default=30, ge=1, le=90, description="Periodo em dias (1-90)"),
    db: AsyncSession = Depends(get_db),
) -> AdminMetricsResponse:
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=days)

    all_users = (await db.execute(select(User))).scalars().all()
    total_users = len(all_users)
    active_users = sum(1 for u in all_users if u.is_active)
    inactive_users = total_users - active_users
    new_users_period = sum(1 for u in all_users if u.created_at >= cutoff)

    messages_period = (
        await db.execute(
            select(func.count(Message.id))
            .join(Session, Session.id == Message.session_id)
            .where(Message.role == "user", Message.created_at >= cutoff)
        )
    ).scalar_one()

    sessions_period = (
        await db.execute(select(func.count(Session.id)).where(Session.created_at >= cutoff))
    ).scalar_one()

    reviews_period = (
        await db.execute(select(func.count(ReviewLog.id)).where(ReviewLog.reviewed_at >= cutoff))
    ).scalar_one()

    reading_rows = (
        await db.execute(
            select(
                ReadingAttempt.completed_at,
                ReadingAttempt.user_id,
                ReadingAttempt.total_questions,
                ReadingAttempt.correct_answers,
            ).where(ReadingAttempt.completed_at >= cutoff)
        )
    ).all()

    reading_activities_period = len(reading_rows)
    reading_questions_answered_period = sum(total for _, _, total, _ in reading_rows)
    reading_correct_answers_period = sum(correct for _, _, _, correct in reading_rows)

    msg_rows = (
        await db.execute(
            select(Message.created_at)
            .join(Session, Session.id == Message.session_id)
            .where(Message.role == "user", Message.created_at >= cutoff)
        )
    ).scalars().all()

    sess_rows = (
        await db.execute(select(Session.created_at).where(Session.created_at >= cutoff))
    ).scalars().all()

    rev_rows = (
        await db.execute(select(ReviewLog.reviewed_at).where(ReviewLog.reviewed_at >= cutoff))
    ).scalars().all()

    daily: dict[str, dict[str, int]] = {}
    for dt in msg_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0, "reading_activities": 0})["messages"] += 1
    for dt in sess_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0, "reading_activities": 0})["sessions"] += 1
    for dt in rev_rows:
        k = dt.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0, "reading_activities": 0})["reviews"] += 1
    for completed_at, _, _, _ in reading_rows:
        k = completed_at.date().isoformat()
        daily.setdefault(k, {"messages": 0, "sessions": 0, "reviews": 0, "reading_activities": 0})["reading_activities"] += 1

    daily_activity = [DailyActivity(date=k, **daily[k]) for k in sorted(daily.keys())]

    user_metrics: list[UserMetric] = []
    for user in all_users:
        u_sessions = (
            await db.execute(select(func.count(Session.id)).where(Session.user_id == user.id))
        ).scalar_one()

        u_messages = (
            await db.execute(
                select(func.count(Message.id))
                .join(Session, Session.id == Message.session_id)
                .where(Session.user_id == user.id, Message.role == "user")
            )
        ).scalar_one()

        u_reviews = (
            await db.execute(
                select(func.count(ReviewLog.id))
                .join(Flashcard, Flashcard.id == ReviewLog.flashcard_id)
                .where(Flashcard.user_id == user.id)
            )
        ).scalar_one()

        reading_totals = (
            await db.execute(
                select(
                    func.count(ReadingAttempt.id),
                    func.coalesce(func.sum(ReadingAttempt.total_questions), 0),
                    func.max(ReadingAttempt.completed_at),
                ).where(ReadingAttempt.user_id == user.id)
            )
        ).one()
        u_reading_activities, u_reading_questions, last_reading_dt = reading_totals

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

        candidates = [d for d in [last_msg_dt, last_rev_dt, last_reading_dt] if d is not None]
        last_active = max(candidates) if candidates else None

        user_metrics.append(
            UserMetric(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                tier=user.tier,
                is_active=user.is_active,
                created_at=user.created_at,
                total_sessions=int(u_sessions),
                total_messages=int(u_messages),
                total_reviews=int(u_reviews),
                total_reading_activities=int(u_reading_activities or 0),
                total_reading_questions=int(u_reading_questions or 0),
                last_active=last_active,
            )
        )

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
        reading_activities_period=int(reading_activities_period),
        reading_questions_answered_period=int(reading_questions_answered_period),
        reading_correct_answers_period=int(reading_correct_answers_period),
        daily_activity=daily_activity,
        user_metrics=user_metrics,
    )
