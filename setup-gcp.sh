#!/bin/bash

echo "🚀 Iniciando configuração para Google Cloud (e2-micro)..."

# 1. Criar Swap de 2GB (Essencial para 1GB RAM)
echo "📦 Configurando SWAP para evitar falta de memória..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap de 2GB criado com sucesso!"
else
    echo "ℹ️  Swap já existe."
fi

# 2. Atualizar Sistema e Instalar Docker
echo "🐳 Instalando Docker..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "✅ Docker instalado!"

# 3. Lembrete de Firewall
echo "--------------------------------------------------------"
echo "⚠️  IMPORTANTE: LIBERAR PORTAS NO FIREWALL DO GOOGLE"
echo "--------------------------------------------------------"
echo "1. Vá no painel do Google Cloud > VPC Network > Firewall"
echo "2. Crie uma regra chamada 'allow-bot-whatsapp'"
echo "3. Targets: All instances in the network"
echo "4. Source filter: 0.0.0.0/0"
echo "5. Protocols and ports: TCP: 3001"
echo "--------------------------------------------------------"
echo "👉 Agora rode: docker compose up -d --build"
