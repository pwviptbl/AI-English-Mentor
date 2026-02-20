#!/bin/bash
# Script simples para deploy rápido na VPS

echo "🚀 Iniciando deploy do AI English Mentor..."

if [ ! -f .env ]; then
    echo "⚠️ Arquivo .env não encontrado!"
    if [ -f .env.example ]; then
        echo "📋 Copiando .env.example para o seu novo arquivo de configuração (.env)..."
        cp .env.example .env
        echo "✅ Arquivo .env criado automaticamente na raiz do projeto."
        echo "🛑 Pare por aqui: Abra o arquivo .env, edite com seu IP e chaves do Google, e rode ./deploy.sh de novo."
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

echo "⏳ Aguardando backend ficar pronto (/healthz)..."
for i in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8000/healthz >/dev/null 2>&1; then
        echo "✅ Backend OK."
        break
    fi
    sleep 1
done

echo "✅ Deploy concluído!"
echo "Verifique os logs com: docker compose logs -f"
