---
description: Guia Completo de Deploy de Produção (Frontend + Bot) na Hostinger VPS
---

Este workflow implanta **todo o sistema** (Site/PDV + Robô WhatsApp) em um único container otimizado no seu servidor VPS.

## Visão Geral
- **Frontend (React/Vite):** Compilado e servido estaticamente.
- **Backend (Node.js/Express):** Serve a API e o Frontend.
- **Bot WhatsApp:** Roda junto no mesmo processo (Puppeteer).
- **Porta:** O sistema ficará acessível na porta 80 (HTTP padrão).

## Passo 1: Acessar o Servidor
Abra seu terminal e conecte via SSH:
```bash
ssh root@SEU_IP_DA_VPS
```

## Passo 2: Atualizar o Repositório
Navegue até a pasta do projeto e baixe a versão mais recente:
```bash
cd /caminho/para/moveis-pedro-ii-hub # Ajuste o caminho conforme necessário
git pull origin main
```

## Passo 3: Configurar Variáveis de Ambiente (.env)
Você precisa criar ou atualizar o arquivo `.env` na RAIZ do projeto.
```bash
nano .env
```
Cole suas variáveis de produção. Certifique-se de incluir:
- `NODE_ENV=production`
- `PORT=3001`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_KEY=...`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`

Salve com `Ctrl + O`, `Enter` e saia com `Ctrl + X`.

## Passo 4: Iniciar o Sistema (Docker Compose)
Use o arquivo de produção `docker-compose.prod.yml` que criamos:

```bash
# Derruba containers antigos (se houver)
docker compose -f docker-compose.prod.yml down

# Constrói e sobe o novo sistema
docker compose -f docker-compose.prod.yml up -d --build
```

**Nota:** O processo de build pode levar alguns minutos na primeira vez, pois ele compila o React e instala dependências e o Chrome.

## Passo 5: Verificação
1.  **Logs:** Acompanhe a inicialização:
    ```bash
    docker logs -f moveis-pedro-ii-app
    ```
2.  **QR Code:** Se for a primeira vez e o robô pedir autenticação, o QR Code aparecerá nos logs.
3.  **Acesso Web:** Abra seu navegador e acesse `http://SEU_IP_DA_VPS`. O sistema deve carregar automaticamente.

## Solução de Problemas
- **Erro de Permissão (EACCES):** Se o Docker reclamar de permissão nas pastas `.wwebjs`, rode:
    ```bash
    chmod -R 777 "robo whatsapp agendamentos/.wwebjs_auth"
    chmod -R 777 "robo whatsapp agendamentos/.wwebjs_cache"
    ```
