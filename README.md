# AI-English-Mentor

Monorepo for a correction-first English conversation mentor.

## Stack

- Backend: FastAPI + SQLAlchemy Async + PostgreSQL
- Frontend: Next.js + Tailwind + Zustand
- AI Router: Gemini (default) or Ollama (local/free)

## 🚀 Deploy em VPS (DigitalOcean, AWS, etc.)

Para rodar em servidores (especialmente com < 4GB de RAM), use o script de configuração automática:

1.  **Acesse seu servidor via SSH**:
    ```bash
    ssh root@seu-ip
    ```
2.  **Clone o repositório e entre na pasta**:
    ```bash
    git clone <SEU_REPO_URL>
    cd AI-English-Mentor
    ```
3.  **Rode o script de setup (APENAS NA PRIMEIRA VEZ)**:
    Isso instala Docker, e configura SWAP (essencial para evitar erros de memória no build).
    ```bash
    chmod +x setup_vps.sh
    ./setup_vps.sh
    ```
    *(Você precisará deslogar e logar novamente no SSH para o Docker funcionar sem sudo)*

4.  **Configure as variáveis de ambiente**:
    ```bash
    cd backend
    cp .env.example .env
    nano .env
    # Edite JWT_SECRET_KEY, GEMINI_API_KEY, e API_BASE_URL (coloque seu IP, ex: http://137.184.20.185:8000/api/v1)
    # Volte para a raiz depois de salvar:
    cd ..
    ```

5.  **Faça o deploy**:
    ```bash
    ./deploy.sh
    ```
    Isso vai buildar e subir os containers. O app estará em `http://IP:3000`.

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
