# Guia de Deploy - Robô WhatsApp

Este guia descreve os passos para colocar o backend do Robô WhatsApp em produção usando o **Render.com** (recomendado por ser gratuito/barato e fácil de usar) e conectar o frontend.

## 1. Preparação do Backend

O backend já foi configurado para produção:
- **Porta Dinâmica**: O `server.js` agora usa `process.env.PORT`.
- **Script de Start**: O `package.json` inclui `"start": "node server.js"`.
- **Dockerfile**: Renomeado e padronizado.

### Passos no Render.com:

1.  Crie uma conta em [render.com](https://render.com).
2.  Clique em **"New"** > **"Web Service"**.
3.  Conecte seu repositório GitHub (`moveispedroii - launch` ou onde o código estiver).
4.  **Configurações do Serviço**:
    - **Name**: `robo-whatsapp-api` (ou outro nome de sua preferência)
    - **Root Directory**: `robo whatsapp agendamentos` (Importante: o código do bot está nesta subpasta)
    - **Environment**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node server.js`
5.  **Variáveis de Ambiente (Environment Variables)**:
    Adicione as seguintes variáveis:
    - `GEMINI_KEY`: (Sua chave da API do Google Gemini, se usada)
    - `SUPABASE_URL`: (Se necessário no backend)
    - `SUPABASE_KEY`: (Se necessário no backend)
    - **Nota**: O Render define `PORT` automaticamente.

6.  Clique em **"Create Web Service"**.
7.  Aguarde o deploy finalizar. O Render fornecerá uma URL (ex: `https://robo-whatsapp-api.onrender.com`). **Copie esta URL.**

## 2. Configuração do Frontend

Agora que o backend está online, precisamos apontar o frontend para ele.

1.  No seu ambiente de produção do frontend (Vercel, Netlify, etc.):
2.  Vá nas **Configurações (Settings)** > **Environment Variables**.
3.  Edite ou Adicione a variável `VITE_ZAP_API_URL`.
4.  Defina o valor como a URL do seu backend no Render (sem a barra no final, se possível, embora o código trate).
    - Exemplo: `https://robo-whatsapp-api.onrender.com`
5.  Redeploy o frontend para que as alterações tenham efeito.

## 3. Verificação

Após o deploy:

1.  Abra o sistema em produção.
2.  Vá para a página de **Configurações** ou teste uma funcionalidade simples (como o Kanban de Logística verificar o status do servidor).
3.  Se o indicador de status ficar verde/online, a conexão foi bem sucedida.

## Solução de Problemas

- **Erro de CORS**: Se houver erros de CORS no console do navegador, verifique se o backend tem a configuração de CORS permitindo a origem do seu frontend (dominio do seu site).
    - Atualmente o `cors` está habilitado genericamente no `server.js`. Se for restritivo, ajuste `origin`.
- **Erro de Conexão**: Verifique se a URL em `VITE_ZAP_API_URL` não tem espaços extras ou erros de digitação.
