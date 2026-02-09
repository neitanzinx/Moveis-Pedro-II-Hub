# Guia de Deploy na Hostinger (Hospedagem Compartilhada)

Este guia explica como colocar o **frontend** do sistema no ar usando uma hospedagem compartilhada da Hostinger (plano Single, Premium ou Business).

> **Atenção:** A hospedagem compartilhada serve apenas para o **Site/Sistema Web**. O **Robô de WhatsApp** precisa rodar em um servidor VPS ou em um serviço como Render.com, pois ele precisa ficar "rodando" constantemente (Node.js), o que hospedagens de site comuns não permitem.

## 1. Preparar os Arquivos (Build)

No seu computador (onde você desenvolve), abra o terminal na pasta do projeto e rode:

```bash
npm run build
```

Isso vai criar uma pasta chamada `dist`. Esta pasta contém **tudo** o que você precisa enviar para a Hostinger.
O comando também vai copiar automaticamente o arquivo `.htaccess` que criamos para garantir que a navegação entre páginas funcione.

## 2. Acessar o Gerenciador de Arquivos da Hostinger

1.  Faça login no painel da Hostinger (hpanel.hostinger.com).
2.  Vá em **Sites** e clique em **Gerenciar** no site desejado.
3.  No menu lateral ou no dashboard, procure por **Gerenciador de Arquivos**.

## 3. Enviar os Arquivos

1.  Dentro do Gerenciador de Arquivos, entre na pasta `public_html`.
    *   Se houver um arquivo `default.php` ou pasta `cgi-bin`, você pode deletá-los (cuidado para não deletar arquivos de outros sites se tiver subdomínios).
2.  **Upload:**
    *   Clique no ícone de "Upload" (seta para cima).
    *   Selecione **Arquivo** se quiser enviar um zip, ou **Pasta** se o navegador permitir.
    *   **Recomendado:** Zipe (comprima) **o conteúdo** da pasta `dist` (não a pasta `dist` em si, mas os arquivos dentro dela) em um arquivo chamado `site.zip`.
    *   Envie o `site.zip` para dentro da `public_html`.
3.  **Extrair:**
    *   Clique com o botão direito no `site.zip` enviado.
    *   Escolha **Extract** (Extrair).
    *   Escolha a pasta atual (`.` ou `/public_html`).
    *   Após extrair, você deve ver arquivos como `index.html`, `vite.svg` e a pasta `assets` soltos dentro da `public_html`.
4.  Delete o arquivo `site.zip` para limpar.

## 4. Verificar

Acesse seu site (ex: `www.seusite.com.br`).
- O sistema deve carregar.
- Tente navegar entre as páginas e recarregar a página (F5) para garantir que a navegação do React Router funcione corretamente.

## 5. Configuração da API e Robô

Lembre-se: O site é estático. Ele precisa se comunicar com o Supabase e com o Robô.
- **Supabase:** Já está configurado nas variáveis de ambiente do build (que foram "queimadas" no código durante o `npm run build`).
- **Robô:** Se você mudou o endereço do robô, precisará atualizar a variável `VITE_ZAP_API_URL` no seu `.env`, rodar o `npm run build` novamente e reenviar os arquivos.

---

### Solução de Problemas Comuns

- **Tela Branca:** Abra o Console do Navegador (F12). Se houver erros vermelhos sobre arquivos não encontrados, verifique se você enviou os arquivos para a `public_html` e não para uma subpasta.
- **Erro 404 ao atualizar a página:** Verifique se o arquivo `.htaccess` está presente na `public_html`. Se não estiver, crie um arquivo com esse nome e cole o seguinte conteúdo:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
