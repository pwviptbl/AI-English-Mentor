# AI-English-Mentor

Monorepo for a correction-first English conversation mentor.

## Stack

- Backend: FastAPI + SQLAlchemy Async + PostgreSQL
- Frontend: Next.js + Tailwind + Zustand
- AI Router: Gemini (default) with optional GitHub Copilot provider

## Project layout

```text
backend/
  app/
  alembic/
  tests/
frontend/
  app/
  src/
ops/
  scripts/
```

## Local run (native-first)

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .[dev]
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend default: `http://localhost:3000`  
Backend default: `http://localhost:8000`

## Copilot optional provider

Enable in `backend/.env`:

```env
ENABLE_COPILOT=true
```

Authenticate before server startup:

```bash
cd backend
python -m app.cli.copilot_auth login
```

## Session and analysis behavior

- Frontend performs automatic token refresh (`/auth/refresh`) on `401` and retries the original request once.
- Message analysis is available for both user and assistant messages.

## Load test (P95)

Run a basic concurrent load test for `/api/v1/chat/send`:

```bash
python ops/scripts/chat_p95_load.py --base-url http://localhost:8000/api/v1 --users 10 --requests-per-user 5 --target-p95-ms 3000
```

The script prints JSON summary with `p50_ms`, `p95_ms`, `p99_ms`, throughput, failures, and exits non-zero if the P95 target is not met.

## API summary

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `PATCH /api/v1/sessions/{session_id}`
- `DELETE /api/v1/sessions/{session_id}`
- `GET /api/v1/sessions/{session_id}/messages`
- `POST /api/v1/chat/send`
- `POST /api/v1/messages/{message_id}/analysis`
- `POST /api/v1/flashcards`
- `GET /api/v1/flashcards/due`
- `POST /api/v1/reviews`
- `GET /api/v1/reviews/stats`
- `GET /api/v1/providers/status`
- `PATCH /api/v1/users/preferences/provider`

## TMUX helper

```bash
bash ops/scripts/dev-tmux.sh
```
