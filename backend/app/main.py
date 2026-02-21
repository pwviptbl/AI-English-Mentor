from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
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

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Adiciona cabeçalhos de segurança contra XSS e Clickjacking/Frames.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Política de segurança restrita da API
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response

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
