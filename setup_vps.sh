#!/bin/bash

# setup_vps.sh - Configuração inicial para VPS (Ubuntu 20.04/22.04/24.04)
# Autor: AI English Mentor Team
# Descrição: Instala Docker, Configura Swap e Firewall básico.

set -e

echo "🚀 Iniciando configuração do servidor..."

# 1. Atualizar sistema
echo "📦 Atualizando pacotes do sistema..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw htop

# 2. Configurar SWAP (4GB) 
# Essencial para VPS com < 4GB RAM rodarem o build do Next.js sem erro de memória.
if [ -f /swapfile ]; then
    echo "✅ Swapfile já existe."
else
    echo "💾 Criando Swap de 4GB..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap configurado com sucesso."
fi

# 3. Instalar Docker e Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    
    # Adicionar usuário atual ao grupo docker (evar sudo no docker)
    sudo usermod -aG docker $USER
    echo "⚠️  ATENÇÃO: Você precisará deslogar e logar novamente para usar docker sem sudo."
else
    echo "✅ Docker já está instalado."
fi

# 4. Instalar Plug-in Docker Compose (se não vier com script acima nas versões novas)
if ! docker compose version &> /dev/null; then
     echo "🔧 Instalando Docker Compose Plugin..."
     sudo apt-get install -y docker-compose-plugin
fi

# 5. Configurar Firewall (UFW)
echo "🛡️  Configurando Firewall (UFW)..."
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
# Com Nginx reverse proxy, frontend/backend ficam internos ao Docker.
# Abra 3000/8000 apenas se precisar depurar externamente.
# sudo ufw allow 3000/tcp
# sudo ufw allow 8000/tcp
# Opcional: Bloquear outras entradas
# sudo ufw default deny incoming
# sudo ufw default allow outgoing
echo "⚠️  O UFW foi configurado permitindo as portas acima. Para ativar, rode: 'sudo ufw enable'"

echo ""
echo "🎉 Configuração concluída!"
echo "---------------------------------------------------"
echo "Próximos passos:"
echo "1. Clone o repositório: git clone <seu-repo-url>"
echo "2. Entre na pasta: cd AI-English-Mentor"
echo "3. Crie os arquivos .env (use os .example)"
echo "4. Rode o deploy: ./deploy.sh"
echo "---------------------------------------------------"
if groups | grep -q "docker"; then
    :
else
    echo "⚠️  IMPORTANTE: Rode 'newgrp docker' ou reinicie a sessão SSH para usar docker sem sudo."
fi
