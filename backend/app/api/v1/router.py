from fastapi import APIRouter

from app.api.v1 import analysis, auth, chat, dictionary, providers, sessions, srs, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(sessions.router)
api_router.include_router(chat.router)
api_router.include_router(analysis.router)
api_router.include_router(dictionary.router)
api_router.include_router(srs.router)
api_router.include_router(providers.router)
api_router.include_router(users.router)
