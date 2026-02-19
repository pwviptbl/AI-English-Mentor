# AI-English-Mentor

Monorepo for a correction-first English conversation mentor.

## Stack

- Backend: FastAPI + SQLAlchemy Async + PostgreSQL
- Frontend: Next.js + Tailwind + Zustand
- AI Router: Gemini (default), Ollama (local/free), or GitHub Copilot

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

### 3) Docker (Recomendado)

```bash
docker-compose up --build
```
Isso sobe o banco de dados (PostgreSQL), o backend e o frontend sincronizados.

Frontend: `http://localhost:3000`  
Backend: `http://localhost:8000`

## Ollama (LLM Local Gratuito)

Para usar modelos locais sem gastar com API:

1. Instale o [Ollama](https://ollama.ai).
2. Baixe o modelo desejado (ex: `ollama pull llama3.2`).
3. Configure o `backend/.env`:
   ```env
   ENABLE_OLLAMA=true
   OLLAMA_MODEL=llama3.2
   ```

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

## Recursos Principais

- **Correção Inteligente**: Analisa erros de gramática e preposição com categorias coloridas.
- **Modo Shadowing**: Pratique pronúncia ouvindo o mentor (TTS) e repetindo (STT).
- **SSE Streaming**: Respostas em tempo real para uma conversa mais fluida.
- **FSRS v4**: Algoritmo de repetição espaçada de última geração para flashcards.
- **Dashboard de Progresso**: Acompanhe sua streak, taxa de acerto e palavras aprendidas.
- **Apoio CEFR**: Sessões e cenários nivelados de A1 a C2.

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
- `POST /api/v1/chat/stream` (SSE)
- `POST /api/v1/messages/{message_id}/analysis` (com cache SHA-256)
- `POST /api/v1/flashcards`
- `GET /api/v1/flashcards/due` (FSRS v4 scheduler)
- `POST /api/v1/reviews`
- `GET /api/v1/reviews/history`
- `GET /api/v1/stats/overview`
- `GET /api/v1/reviews/stats`
- `GET /api/v1/providers/status`
- `PATCH /api/v1/users/preferences/provider`

## TMUX helper

```bash
bash ops/scripts/dev-tmux.sh
```
