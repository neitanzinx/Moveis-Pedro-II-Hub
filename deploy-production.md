# Guia de Deploy de Produção (VPS Hostinger)

Este workflow implanta **todo o sistema** (Site/PDV + Robô WhatsApp) na sua VPS Hostinger usando Docker.

## Visão Geral
- **Frontend (React/Vite):** Compilado e servido pelo Node.js.
- **Backend (Node.js/Express):** Serve a API e o Frontend (Modo Monólito).
- **Bot WhatsApp:** Roda junto no mesmo processo.
- **Porta:** O sistema ficará acessível na porta 80 (HTTP padrão).

## Passo 1: Preparar o Servidor (Acesso SSH)
Abra seu terminal e conecte via SSH:
```bash
ssh root@SEU_IP_DA_VPS
```

## Passo 2: Atualizar o Código
Navegue até a pasta do projeto:
```bash
cd /caminho/para/moveis-pedro-ii-hub
git pull origin main
```
> **Nota:** Se você fez alterações locais no servidor, pode precisar usar `git stash` antes do `git pull`.

## Passo 3: Configurar Variáveis de Ambiente (.env)
Garanta que o arquivo `.env` na RAIZ do projeto esteja correto:
```bash
nano .env
```
Variáveis essenciais:
- `NODE_ENV=production`
- `PORT=3001`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_KEY=<SUA_CHAVE_SERVICE_ROLE_AQUI>`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`
- `VITE_ZAP_API_URL=` (Deixe vazio ou use a URL do seu site se necessário, mas no modo monólito ele usa a relativa)

## Passo 4: Configurar Segredos do Supabase (Novo!)
Para o webhook de PIX funcionar e notificar o robô, você precisa informar a URL da sua VPS:

```bash
# Rode isso LOCALMENTE no seu PC (onde tem o Supabase CLI) ou no Dashboard do Supabase
npx supabase secrets set APP_API_URL=http://SEU_IP_DA_VPS
```
*Substitua `http://SEU_IP_DA_VPS` pelo IP real da sua máquina (ex: `http://192.168.1.1`).*

## Passo 5: Deploy com Docker Compose
Use o arquivo de produção `docker-compose.prod.yml`:

```bash
# 1. Derrubar a versão antiga
docker compose -f docker-compose.prod.yml down

# 2. Construir e subir a nova versão
docker compose -f docker-compose.prod.yml up -d --build
```

### Por que `--build`?
O comando `--build` é crucial porque ele força o Docker a recriar a imagem, o que inclui rodar o `npm run build` do React novamente para pegar suas últimas alterações do frontend.

## Passo 6: Verificação e Login no WhatsApp
1.  **Verifique os Logs:**
    ```bash
    docker logs -f moveis-pedro-ii-app
    ```
2.  **QR Code:** Se o robô não estiver conectado, o QR Code aparecerá no terminal. Escaneie com seu celular.
3.  **Acesso Web:** Abra `http://SEU_IP_DA_VPS` no navegador.

## Solução de Problemas

### Erro de Permissão na pasta .wwebjs
Se o robô entrar em loop de autenticação, pode ser permissão de escrita. Rode:
```bash
chmod -R 777 "robo-whatsapp-agendamentos/.wwebjs_auth"
chmod -R 777 "robo-whatsapp-agendamentos/.wwebjs_cache"
```

### O site não carrega (Tela Branca)
Se o site carrega em branco, verifique os logs do navegador (F12 > Console). Se houver erros 404 para arquivos JS/CSS, certifique-se de que o `server.js` está servindo a pasta `dist` corretamente.
