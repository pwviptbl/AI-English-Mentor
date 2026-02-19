from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.init_db import init_db
from app.middleware.request_context import RequestContextMiddleware


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


setup_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

allow_origins = settings.allowed_origins
if settings.environment.lower() == "development" and settings.cors_allow_all_dev:
    allow_origins = ["*"]

# Request context first, then CORS as outer middleware.
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}
