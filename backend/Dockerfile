FROM python:3.13-slim

RUN useradd -m -r appuser

WORKDIR /app

COPY --chown=appuser:appuser pyproject.toml README.md ./
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser alembic.ini ./
COPY --chown=appuser:appuser alembic ./alembic

RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir .

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
