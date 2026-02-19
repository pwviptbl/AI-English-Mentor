#!/bin/bash
# Script simples para deploy rápido na VPS

echo "🚀 Iniciando deploy do AI English Mentor..."

if [ ! -f backend/.env ]; then
    echo "⚠️ Arquivo backend/.env não encontrado!"
    if [ -f backend/.env.example ]; then
        echo "📋 Copiando backend/.env.example para backend/.env..."
        cp backend/.env.example backend/.env
        echo "✅ backend/.env criado automaticamente."
        echo "🛑 Pare o script, edite backend/.env com seu IP (API_BASE_URL) e chaves, e rode deploy.sh de novo."
        exit 1
    else
        echo "❌ Erro: backend/.env.example não encontrado."
        exit 1
    fi
fi

echo "🔄 Baixando atualizações (git pull)..."
git pull

echo "🐳 Construindo e iniciando containers..."
docker compose up -d --build

echo "✅ Deploy concluído!"
echo "Verifique os logs com: docker compose logs -f"
