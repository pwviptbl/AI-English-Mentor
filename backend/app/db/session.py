from collections.abc import AsyncGenerator

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def normalize_database_url(raw_database_url: str) -> tuple[str, dict[str, bool]]:
    normalized_input = raw_database_url.strip()
    if normalized_input.startswith("postgres://"):
        normalized_input = f"postgresql+asyncpg://{normalized_input[len('postgres://') :]}"

    url = make_url(normalized_input)
    connect_args: dict[str, bool] = {}

    backend_name, _, driver_name = url.drivername.partition("+")
    if backend_name == "postgresql" and driver_name != "asyncpg":
        url = url.set(drivername="postgresql+asyncpg")

    if url.drivername == "postgresql+asyncpg":
        query = dict(url.query)
        sslmode = query.pop("sslmode", None)
        if sslmode and "ssl" not in query:
            # asyncpg uses `ssl` (bool/SSLContext), while many managed DB URLs expose `sslmode`.
            connect_args["ssl"] = sslmode.lower() not in {"disable", "allow", "prefer"}
        url = url.set(query=query)

    return url.render_as_string(hide_password=False), connect_args


normalized_database_url, connect_args = normalize_database_url(settings.database_url)
engine_kwargs = {"pool_pre_ping": True}
if connect_args:
    engine_kwargs["connect_args"] = connect_args
engine = create_async_engine(normalized_database_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
