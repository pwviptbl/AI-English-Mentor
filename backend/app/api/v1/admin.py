"""Endpoints administrativos — listagem de usuários, gestão de tier e limites."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.models import TierLimits, User
from app.db.session import get_db
from app.schemas.admin import AdminUserListItem, AdminUserUpdate, TierLimitsResponse, TierLimitsUpdate
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
