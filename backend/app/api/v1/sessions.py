from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Message, Session, User
from app.db.session import get_db
from app.schemas.messages import MessageResponse
from app.schemas.sessions import SessionCreate, SessionResponse, SessionUpdate

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    session_obj = Session(
        user_id=current_user.id,
        topic=payload.topic,
        persona_prompt=payload.persona_prompt,
        cefr_level=payload.cefr_level,
    )
    db.add(session_obj)
    await db.commit()
    await db.refresh(session_obj)
    return session_obj


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionResponse]:
    stmt = select(Session).where(Session.user_id == current_user.id).order_by(Session.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    stmt = select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="session not found")
    return session_obj


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    payload: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionResponse:
    stmt = select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="session not found")

    if payload.topic is not None:
        session_obj.topic = payload.topic
    if payload.persona_prompt is not None:
        session_obj.persona_prompt = payload.persona_prompt
    if payload.cefr_level is not None:
        session_obj.cefr_level = payload.cefr_level

    await db.commit()
    await db.refresh(session_obj)
    return session_obj


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    stmt = select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    session_obj = (await db.execute(stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="session not found")

    await db.delete(session_obj)
    await db.commit()
    return Response(status_code=204)


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
async def list_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    session_stmt = select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    session_obj = (await db.execute(session_stmt)).scalar_one_or_none()
    if not session_obj:
        raise HTTPException(status_code=404, detail="session not found")

    stmt = select(Message).where(Message.session_id == session_id).order_by(Message.created_at.asc())
    return list((await db.execute(stmt)).scalars().all())
