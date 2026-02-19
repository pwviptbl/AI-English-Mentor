from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_auth_rate_limit_dep, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import RefreshTokenRequest, TokenPair, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, dependencies=[Depends(get_auth_rate_limit_dep())])
async def register_user(payload: UserRegister, db: AsyncSession = Depends(get_db)) -> UserResponse:
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="email already registered")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPair, dependencies=[Depends(get_auth_rate_limit_dep())])
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> TokenPair:
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid email or password")

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        data = decode_refresh_token(payload.refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="invalid refresh token")

    user_id = data.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid refresh token")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="user not found")

    return TokenPair(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserResponse)
async def current_user_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user
