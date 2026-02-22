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

echo "🐳 Construindo e iniciando containers..."
docker compose up -d --build

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
