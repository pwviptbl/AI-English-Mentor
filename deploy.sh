#!/bin/bash
# Script simples para deploy rápido na VPS

set -e

echo "🚀 Iniciando deploy do AI English Mentor..."

if [ ! -f .env ]; then
    echo "⚠️ Arquivo .env não encontrado!"
    if [ -f .env.example ]; then
        echo "📋 Copiando .env.example para o seu novo arquivo de configuração (.env)..."
        cp .env.example .env
        echo "✅ Arquivo .env criado automaticamente na raiz do projeto."
        echo "🛑 Pare por aqui: Abra o arquivo .env, edite os segredos/JWT e chaves de IA, e rode ./deploy.sh de novo."
        exit 1
    else
        echo "❌ Erro: .env.example não encontrado."
        exit 1
    fi
fi

echo "🔄 Baixando atualizações (git pull)..."
git pull

echo "🐳 Construindo imagens..."
docker compose build

echo "🗄️  Iniciando banco de dados..."
docker compose up -d postgres

echo "⏳ Aguardando PostgreSQL ficar pronto..."
for i in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ai_english_mentor}" >/dev/null 2>&1; then
        echo "✅ PostgreSQL pronto."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "❌ PostgreSQL não respondeu a tempo."
        exit 1
    fi
    sleep 2
done

echo "🔁 Executando migrações (alembic upgrade head)..."

# Detecta banco legado: tabela users existe mas alembic_version não (ou está vazia).
# Nesses casos, fecha o histórico no head sem re-executar DDL que já foi aplicado.
USERS_EXISTS=$(docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-ai_english_mentor}" \
    -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" \
    2>/dev/null || echo "0")

ALEMBIC_ROWS=$(docker compose exec -T postgres psql \
    -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-ai_english_mentor}" \
    -tAc "SELECT COUNT(*) FROM alembic_version" 2>/dev/null || echo "0")

USERS_EXISTS="${USERS_EXISTS//[[:space:]]/}"
ALEMBIC_ROWS="${ALEMBIC_ROWS//[[:space:]]/}"

if [ "${USERS_EXISTS:-0}" -gt "0" ] && [ "${ALEMBIC_ROWS:-0}" -eq "0" ]; then
    echo "  ⚠️  Banco legado detectado (sem histórico Alembic)."
    echo "      Registrando schema base (0001-0003) e rodando migrações novas..."
    # Stamp até a última migration que faz parte do schema original (antes de tier_limits/is_active).
    # As migrations 0004 e 0005 rodarão de verdade abaixo (são idempotentes).
    docker compose run --rm backend alembic stamp 20260219_0003
fi

docker compose run --rm backend alembic upgrade head
echo "✅ Migrações aplicadas."

echo "🐳 Iniciando todos os serviços..."
docker compose up -d

echo "⏳ Aguardando backend ficar pronto (/healthz interno)..."
backend_ready=0
for i in $(seq 1 90); do
    if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz').read()" >/dev/null 2>&1; then
        echo "✅ Backend OK."
        backend_ready=1
        break
    fi
    sleep 1
done

if [ "$backend_ready" -ne 1 ]; then
    echo "❌ Backend não respondeu no tempo esperado."
    docker compose logs --tail=80 backend
    exit 1
fi

echo "⏳ Aguardando Nginx responder em http://127.0.0.1 ..."
nginx_ready=0
for i in $(seq 1 60); do
    if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
        echo "✅ Nginx OK."
        nginx_ready=1
        break
    fi
    sleep 1
done

if [ "$nginx_ready" -ne 1 ]; then
    echo "❌ Nginx não respondeu no tempo esperado."
    docker compose logs --tail=80 nginx
    exit 1
fi

echo "✅ Deploy concluído!"
echo "A aplicação está disponível em: http://SEU_IP"
echo "Verifique os logs com: docker compose logs -f"
