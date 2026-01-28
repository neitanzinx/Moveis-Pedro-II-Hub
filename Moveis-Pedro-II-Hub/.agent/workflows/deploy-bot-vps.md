---
description: Guia de Deploy do Bot WhatsApp na Hostinger VPS com Docker
---

Este guia detalha como colocar o robô de WhatsApp em produção no seu servidor VPS da Hostinger.

## Pré-requisitos
- Acesso SSH ao servidor VPS (IP e Senha root).
- Repositório Git configurado no servidor (já clonado ou pronto para clonar).

## Passo 1: Acessar o Servidor
Abra seu terminal (PowerShell ou CMD) e conecte via SSH:
```bash
ssh root@SEU_IP_DA_VPS
# Digite a senha quando pedir (ela não aparece enquanto digita)
```

## Passo 2: Instalar Docker (Se ainda não tiver)
// turbo
Verifique se o Docker está instalado:
```bash
docker --version
```
Se não estiver, rode este comando para instalar tudo de uma vez:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
```

## Passo 3: Atualizar o Código
Navegue até a pasta do projeto e atualize:
```bash
cd /caminho/para/seu/projeto/Moveis-Pedro-II-Hub
git pull origin main
```

## Passo 4: Subir o Robô
Navegue para a pasta do robô e inicie com Docker Compose:
```bash
cd "robo whatsapp agendamentos"
# O comando abaixo constrói a imagem e inicia o container em segundo plano
docker compose up -d --build
```

## Comandos Úteis
- **Ver logs em tempo real:**
  ```bash
  docker logs -f bot-whatsapp
  ```
- **Reiniciar o robô:**
  ```bash
  docker compose restart bot-whatsapp
  ```
- **Parar o robô:**
  ```bash
  docker compose down
  ```

## Autenticação (QR Code)
Na primeira vez, você precisará ler o QR Code.
1. Veja os logs: `docker logs -f bot-whatsapp`
2. O QR Code aparecerá no terminal.
3. Abra o WhatsApp no celular -> Aparelhos Conectados -> Conectar Aparelho.
4. Escaneie o código.
5. Quando conectar, dê `Ctrl + C` para sair dos logs (o robô continua rodando).
