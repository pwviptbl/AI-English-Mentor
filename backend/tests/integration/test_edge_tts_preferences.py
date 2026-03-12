import asyncio

from sqlalchemy import select

from app.db.models import User
from app.db.session import AsyncSessionLocal


async def _activate_user(email: str) -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one()
        user.is_active = True
        await db.commit()


def _auth_headers(client, email: str = "voice@example.com", password: str = "secret1234") -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Voice User", "email": email, "password": password},
    )
    asyncio.run(_activate_user(email))
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_returns_default_edge_tts_voice(client) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Voice Default", "email": "voice-default@example.com", "password": "secret1234"},
    )

    assert response.status_code == 200
    assert response.json()["edge_tts_voice"] == "en-US-JennyNeural"


def test_update_profile_persists_edge_tts_voice(client) -> None:
    headers = _auth_headers(client, email="voice-update@example.com")

    response = client.patch(
        "/api/v1/users/me",
        headers=headers,
        json={"edge_tts_voice": "en-GB-SoniaNeural"},
    )

    assert response.status_code == 200
    assert response.json()["edge_tts_voice"] == "en-GB-SoniaNeural"