from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return str(uuid4())


def _utc_now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    preferred_ai_provider: Mapped[str] = mapped_column(String(32), default="gemini")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    topic: Mapped[str] = mapped_column(String(120))
    persona_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    user: Mapped[User] = relationship(back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_corrected: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_final: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    meta_json: Mapped[dict | None] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[Session] = relationship(back_populates="messages")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    word: Mapped[str] = mapped_column(String(120), index=True)
    lemma: Mapped[str | None] = mapped_column(String(120), nullable=True)
    pos: Mapped[str | None] = mapped_column(String(32), nullable=True)
    translation: Mapped[str | None] = mapped_column(String(240), nullable=True)
    definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)

    next_review: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, index=True)
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    lapses: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now
    )

    user: Mapped[User] = relationship(back_populates="flashcards")
    review_logs: Mapped[list["ReviewLog"]] = relationship(
        back_populates="flashcard", cascade="all, delete-orphan"
    )


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    flashcard_id: Mapped[str] = mapped_column(ForeignKey("flashcards.id", ondelete="CASCADE"), index=True)
    rating: Mapped[str] = mapped_column(String(16))
    old_interval: Mapped[int] = mapped_column(Integer)
    new_interval: Mapped[int] = mapped_column(Integer)
    old_ef: Mapped[float] = mapped_column(Float)
    new_ef: Mapped[float] = mapped_column(Float)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)

    flashcard: Mapped[Flashcard] = relationship(back_populates="review_logs")
