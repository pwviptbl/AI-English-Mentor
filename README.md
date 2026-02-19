# AI-English-Mentor

Monorepo for a correction-first English conversation mentor.

## Stack

- Backend: FastAPI + SQLAlchemy Async + PostgreSQL
- Frontend: Next.js + Tailwind + Zustand
- AI Router: Gemini (default), Ollama (local/free), or GitHub Copilot

## Instalação em VPS (Digital Ocean e outros)

Siga este passo a passo para rodar o projeto em um servidor Linux (Ubuntu/Debian) e acessar pelo celular.

### 1. Preparação (no servidor)

Instale Git e Docker:

```bash
sudo apt update && sudo apt install -y git
# Instale Docker (script oficial)
curl -fsSL https://get.docker.com | sh
```

### 2. Clonar o projeto

```bash
git clone https://github.com/pwviptbl/AI-English-Mentor.git
cd AI-English-Mentor
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo para `.env`:

```bash
cp .env.deploy.example .env
```

Edite o arquivo `.env` com seu editor favorito (nano/vim):
```bash
nano .env
```

**Importante:**
- Mude `API_BASE_URL` para o **IP PÚBLICO** da sua VPS (ex: `http://159.223.x.x:8000/api/v1`).
- Mude `ALLOWED_ORIGINS` para o IP PÚBLICO da sua VPS (ex: `http://159.223.x.x:3000`).
- Adicione sua `GEMINI_API_KEY`.

### 4. Rodar com Docker

Como o Docker já encapsula tudo (banco de dados, python, nodejs), basta rodar:

```bash
docker compose up -d --build
```

Isso vai baixar as dependências e iniciar os serviços. Pode levar alguns minutos na primeira vez.

### 5. Acessar

- Abra no navegador do seu celular: `http://SEU_IP_DA_VPS:3000`
- O backend estará rodando em: `http://SEU_IP_DA_VPS:8000`

---

## Ollama (Opcional: IA Local Gratuita)

Se quiser usar o Ollama na VPS para economizar API Key (exige +/- 4GB RAM para modelo pequeno):

1. Instale o Ollama no servidor: `curl -fsSL https://ollama.com/install.sh | sh`
2. Baixe o modelo: `ollama pull llama3.2`
3. No `.env`, mude:
   ```env
   ENABLE_OLLAMA=true
   OLLAMA_BASE_URL=http://host.docker.internal:11434
   ```
4. Reinicie o backend: `docker compose restart backend`

---

## Desenvolvimento Local

Se quiser rodar no seu computador para desenvolver:

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e .[dev]
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install && npm run dev
```

## Recursos

- **Correção Inteligente**: Analisa erros de gramática e preposição.
- **Modo Shadowing**: Pratique pronúncia ouvindo o mentor.
- **SSE Streaming**: Respostas em tempo real.
- **FSRS v4**: Algoritmo de repetição espaçada para flashcards.
- **Dashboard**: Acompanhe progresso.
