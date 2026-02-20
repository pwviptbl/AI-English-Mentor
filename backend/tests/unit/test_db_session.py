from app.db.session import normalize_database_url


def test_normalize_postgres_scheme_to_asyncpg() -> None:
    url, connect_args = normalize_database_url("postgres://user:pass@db:5432/app")

    assert url == "postgresql+asyncpg://user:pass@db:5432/app"
    assert connect_args == {}


def test_normalize_postgresql_scheme_to_asyncpg() -> None:
    url, connect_args = normalize_database_url("postgresql://user:pass@db:5432/app")

    assert url == "postgresql+asyncpg://user:pass@db:5432/app"
    assert connect_args == {}


def test_translate_sslmode_require_for_asyncpg() -> None:
    url, connect_args = normalize_database_url(
        "postgresql+asyncpg://user:pass@db:5432/app?sslmode=require&application_name=ai-mentor"
    )

    assert url == "postgresql+asyncpg://user:pass@db:5432/app?application_name=ai-mentor"
    assert connect_args == {"ssl": True}


def test_translate_sslmode_disable_for_asyncpg() -> None:
    url, connect_args = normalize_database_url("postgresql+asyncpg://user:pass@db:5432/app?sslmode=disable")

    assert url == "postgresql+asyncpg://user:pass@db:5432/app"
    assert connect_args == {"ssl": False}


def test_keep_explicit_ssl_query_without_connect_arg_override() -> None:
    url, connect_args = normalize_database_url(
        "postgresql+asyncpg://user:pass@db:5432/app?ssl=true&sslmode=require"
    )

    assert url == "postgresql+asyncpg://user:pass@db:5432/app?ssl=true"
    assert connect_args == {}
