#!/bin/bash
# Script simples para deploy rápido na VPS

echo "🚀 Iniciando deploy do AI English Mentor..."

if [ ! -f .env ]; then
    echo "⚠️ Arquivo .env não encontrado!"
    echo "📋 Copiando exemplo... Por favor, edite o arquivo .env com suas configurações reais."
    cp .env.deploy.example .env
    echo "✅ .env criado."
    echo "🛑 Edite o arquivo .env agora e rode este script novamente."
    exit 1
fi

# Verifica se o .env do backend existe (necessário para o docker compose)
if [ ! -f backend/.env ]; then
    echo "⚠️ Arquivo backend/.env não encontrado!"
    if [ -f backend/.env.example ]; then
        echo "📋 Copiando backend/.env.example para backend/.env..."
        cp backend/.env.example backend/.env
        echo "✅ backend/.env criado automaticamente."
    else
        echo "❌ Erro: backend/.env.example não encontrado. Criando arquivo mínimo..."
        echo "APP_NAME=AI English Mentor API" > backend/.env
        echo "ENVIRONMENT=production" >> backend/.env
    fi
fi

echo "🔄 Baixando atualizações (git pull)..."
git pull

echo "🐳 Construindo e iniciando containers..."
docker compose up -d --build

echo "✅ Deploy concluído!"
echo "Backend deve estar rodando em: $(grep API_BASE_URL .env | cut -d= -f2)"
echo "Frontend deve estar rodando em: $(grep ALLOWED_ORIGINS .env | cut -d= -f2)"
