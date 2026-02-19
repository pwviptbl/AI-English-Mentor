import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models import Message, Session, User
from app.schemas.chat import ChatSendRequest
from app.services.llm_router import LLMRouter

logger = get_logger(__name__)


class ChatService:
    def __init__(self, db: AsyncSession, llm_router: LLMRouter) -> None:
        self.db = db
        self.llm_router = llm_router

    async def send_message(self, user: User, payload: ChatSendRequest) -> dict:
        session_stmt = select(Session).where(
            Session.id == payload.session_id,
            Session.user_id == user.id,
        )
        session = (await self.db.execute(session_stmt)).scalar_one_or_none()
        if not session:
            raise ValueError("session not found")

        history_stmt = (
            select(Message)
            .where(Message.session_id == session.id)
            .order_by(Message.created_at.asc())
            .limit(100)
        )
        history_messages = (await self.db.execute(history_stmt)).scalars().all()
        history = [{"role": m.role, "content": m.content_final} for m in history_messages]

        context = {
            "topic": session.topic,
            "persona_prompt": session.persona_prompt,
            "learner_name": user.full_name,
        }

        start = time.perf_counter()
        correction, correction_provider, correction_model = await self.llm_router.correct_input(
            raw_text=payload.text_raw,
            context=context,
            provider_override=payload.provider_override,
            user_preference=user.preferred_ai_provider,
        )

        user_message = Message(
            session_id=session.id,
            role="user",
            content_raw=payload.text_raw,
            content_corrected=correction.corrected_text,
            content_final=correction.corrected_text,
            provider=correction_provider,
            model=correction_model,
            meta_json={"changed": correction.changed, "notes": correction.notes},
        )
        self.db.add(user_message)
        await self.db.flush()

        history_with_new = history + [{"role": "user", "content": correction.corrected_text}]

        reply, reply_provider, reply_model = await self.llm_router.generate_reply(
            corrected_text=correction.corrected_text,
            history=history_with_new,
            context=context,
            provider_override=payload.provider_override,
            user_preference=user.preferred_ai_provider,
        )

        assistant_message = Message(
            session_id=session.id,
            role="assistant",
            content_raw=None,
            content_corrected=None,
            content_final=reply.reply,
            provider=reply_provider,
            model=reply_model,
            meta_json={},
        )
        self.db.add(assistant_message)
        await self.db.commit()

        latency_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "chat.completed",
            extra={
                "user_id": user.id,
                "session_id": session.id,
                "user_message_id": user_message.id,
                "assistant_message_id": assistant_message.id,
                "correction_provider": correction_provider,
                "correction_model": correction_model,
                "reply_provider": reply_provider,
                "reply_model": reply_model,
                "latency_ms": latency_ms,
            },
        )

        return {
            "user_message_id": user_message.id,
            "corrected_text": correction.corrected_text,
            "correction_meta": {
                "changed": correction.changed,
                "notes": correction.notes,
                "provider": correction_provider,
                "model": correction_model,
            },
            "assistant_message_id": assistant_message.id,
            "assistant_reply": reply.reply,
            "provider_used": reply_provider,
            "model_used": reply_model,
            "latency_ms": latency_ms,
        }
