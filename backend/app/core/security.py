from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = "HS256"


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def _build_token(subject: str, token_type: str, expires_delta: timedelta, secret: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "typ": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def create_access_token(subject: str) -> str:
    return _build_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        secret=settings.jwt_secret_key,
    )


def create_refresh_token(subject: str) -> str:
    return _build_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        secret=settings.jwt_refresh_secret_key,
    )


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise TokenError("invalid access token") from exc
    if payload.get("typ") != "access":
        raise TokenError("wrong token type")
    return payload


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_refresh_secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise TokenError("invalid refresh token") from exc
    if payload.get("typ") != "refresh":
        raise TokenError("wrong token type")
    return payload
