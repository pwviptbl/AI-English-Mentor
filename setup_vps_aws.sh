#!/bin/bash

# setup_vps_aws.sh - Configuração inicial para VPS na AWS (Amazon Linux 2023 / AL2)
# Autor: AI English Mentor Team
# Descrição: Instala Docker, Docker Compose e Configura Swap usando DNF.
# O firewall nas instâncias EC2 é feito preferencialmente através do painel da AWS (Security Groups).

set -e

echo "🚀 Iniciando configuração do servidor AWS..."

# 1. Atualizar sistema
echo "📦 Atualizando pacotes do sistema com DNF..."
sudo dnf update -y
sudo dnf install -y curl git htop

# 2. Configurar SWAP (4GB) 
# Essencial para instâncias como t2.micro rodarem sem erro de memória.
# Na AWS, é mais recomendado usar `dd` para criação de swap em certos sistemas de arquivos.
if [ -f /swapfile ]; then
    echo "✅ Swapfile já existe."
else
    echo "💾 Criando Swap de 4GB..."
    sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap configurado com sucesso."
fi

# 3. Instalar Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    sudo dnf install -y docker
    
    # Habilitando o docker para iniciar no boot e iniciando o serviço
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # Adicionar usuário atual ao grupo docker (ex: ec2-user)
    sudo usermod -aG docker $USER
    echo "⚠️  ATENÇÃO: Você precisará deslogar e logar novamente para usar docker sem sudo."
else
    echo "✅ Docker já está instalado."
fi

# 4. Instalar Docker Compose (como plugin do Docker v2)
if ! docker compose version &> /dev/null; then
     echo "🔧 Instalando Docker Compose Plugin..."
     
     # Tentativa via repositório dnf nativo
     if sudo dnf install -y docker-compose-plugin; then
         echo "✅ Docker Compose Plugin instalado pelo DNF."
     else
         echo "Baixando release oficial do GitHub..."
         DOCKER_CLI_DIR=/usr/local/lib/docker/cli-plugins
         sudo mkdir -p $DOCKER_CLI_DIR
         sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o $DOCKER_CLI_DIR/docker-compose
         sudo chmod +x $DOCKER_CLI_DIR/docker-compose
         
         # Alias/Symlink pra facilitar acesso globals
         sudo ln -sf $DOCKER_CLI_DIR/docker-compose /usr/local/bin/docker-compose
     fi
fi

# 5. Configurar Firewall (Notas para a AWS)
echo "🛡️  Configuração de Firewall:"
echo "Nas instâncias EC2 da AWS, não usamos UFW local para evitar conflitos."
echo "Certifique-se de liberar as seguintes Portas de Entrada (Inbound) no seu Security Group pela interface da AWS:"
echo " - Porta 22 (SSH)"
echo " - Porta 80 (HTTP)"
echo " - Porta 443 (HTTPS)"

echo ""
echo "🎉 Configuração AWS concluída!"
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
    echo "⚠️  IMPORTANTE: Rode 'newgrp docker' ou reinicie a sessão SSH para aplicar as permissões do grupo Docker."
fi
