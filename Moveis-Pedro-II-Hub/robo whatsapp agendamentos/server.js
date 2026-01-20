const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURAÇÕES (via variáveis de ambiente) ---
const PORT = process.env.PORT || 3001;
// const GEMINI_KEY = process.env.GEMINI_API_KEY; // Removido para busca dinâmica

// 🚨 SUPABASE (Banco de Dados)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
const port = process.env.PORT || 3001;

// 🛡️ Bulletproof CORS: Allow ALL origins.
app.use(cors());

// 🛡️ Global Crash Prevention
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR (Uncaught):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔥 CRITICAL ERROR (Unhandled Rejection):', reason);
});

// Aumentar limite de listeners
require('events').EventEmitter.defaultMaxListeners = 20;
// Aumentar limite do body para suportar PDF base64 (~200KB+)
app.use(express.json({ limit: '10mb' }));

// 🏗️ SERVE FRONTEND (Monolith Mode)
// Serves static files from the React build folder (../dist)
app.use(express.static(path.join(__dirname, '../dist')));

// const genAI = new GoogleGenerativeAI(GEMINI_KEY); // Movido para dentro da rota
// const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Critical for Render/Docker to reduce memory
            '--disable-gpu'
        ],
        timeout: 60000,
        handleSIGINT: false, // Let Render handle signals
        handleSIGTERM: false,
        handleSIGHUP: false
    }
});

let filaEspera = {};
let mapaEntregas = {};

// --- ESTADO DA CONEXÃO WHATSAPP ---
let currentQR = null;
let connectionStatus = 'initializing'; // 'initializing' | 'waiting_qr' | 'connected' | 'disconnected'
let connectionInfo = null;

function limparJSON(texto) {
    try {
        const inicio = texto.indexOf('{');
        const fim = texto.lastIndexOf('}');
        if (inicio !== -1 && fim !== -1) return JSON.parse(texto.substring(inicio, fim + 1));
        return JSON.parse(texto);
    } catch (e) { return null; }
}

client.on('qr', qr => {
    currentQR = qr;
    connectionStatus = 'waiting_qr';
    qrcode.generate(qr, { small: true }); // Manter no terminal também
    console.log('📱 QR Code gerado - disponível na interface web');
});

client.on('ready', async () => {
    currentQR = null;
    connectionStatus = 'connected';
    try {
        const info = await client.info;
        connectionInfo = {
            wid: info?.wid?.user || 'N/A',
            pushname: info?.pushname || 'WhatsApp Bot',
            platform: info?.platform || 'unknown'
        };
    } catch (e) { connectionInfo = null; }
    console.log('✅ Robô Logístico 6.0 (Informativo) Online!');
});

client.on('disconnected', (reason) => {
    currentQR = null;
    connectionStatus = 'disconnected';
    connectionInfo = null;
    console.log('❌ WhatsApp desconectado:', reason);
});

client.on('auth_failure', (msg) => {
    currentQR = null;
    connectionStatus = 'disconnected';
    console.log('⚠️ Falha na autenticação:', msg);
});

// --- ROTA DE HEALTH CHECK (RENDER) ---
app.get('/', (req, res) => res.status(200).send('Bot is running! 🚀'));

// --- ROTA DE STATUS GERAL ---
app.get('/status', (req, res) => res.json({ status: 'online' }));

// --- ROTA DE STATUS DO WHATSAPP (PARA A INTERFACE) ---
app.get('/whatsapp/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: currentQR,
        info: connectionInfo
    });
});

// --- ROTA PARA CARREGAR CONFIGURAÇÕES DO AGENTE IA ---
app.get('/whatsapp/ai-settings', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_bot_settings')
            .select('key, value');

        if (error) throw error;

        // Converter array para objeto chave-valor
        const settings = {};
        (data || []).forEach(row => {
            settings[row.key] = row.value;
        });

        res.json(settings);
    } catch (e) {
        console.error('Erro ao carregar configurações:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA PARA SALVAR CONFIGURAÇÕES DO AGENTE IA ---
app.post('/whatsapp/ai-settings', async (req, res) => {
    try {
        const settings = req.body;

        // Upsert cada configuração
        for (const [key, value] of Object.entries(settings)) {
            const { error } = await supabase
                .from('whatsapp_bot_settings')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });

            if (error) throw error;
        }

        console.log('✅ Configurações do agente IA salvas');
        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao salvar configurações:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA PARA FORÇAR RECONEXÃO ---
app.post('/whatsapp/reconnect', async (req, res) => {
    try {
        connectionStatus = 'initializing';
        currentQR = null;

        // Tentar reinicializar o cliente
        await client.destroy();
        await client.initialize();

        res.json({ success: true, message: 'Reconexão iniciada' });
    } catch (e) {
        console.error('Erro ao reconectar:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA PARA DESCONECTAR ---
app.post('/whatsapp/disconnect', async (req, res) => {
    try {
        await client.logout();
        connectionStatus = 'disconnected';
        currentQR = null;
        connectionInfo = null;

        res.json({ success: true, message: 'Desconectado com sucesso' });
    } catch (e) {
        console.error('Erro ao desconectar:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 1: DISPARO DE CONFIRMAÇÕES (ASSERTIVO / INFORMATIVO) ---
app.post('/disparar-confirmacoes', async (req, res) => {
    const { entregas } = req.body;
    console.log(`📦 Recebido lote de ${entregas.length} entregas.`);
    res.json({ success: true });

    for (const entrega of entregas) {
        if (!entrega.telefone) continue;
        let tel = entrega.telefone.replace(/\D/g, '');
        if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;

        try {
            const numberId = await client.getNumberId(tel);
            const chatId = numberId ? numberId._serialized : `${tel}@c.us`;

            const dadosEntrega = {
                id: entrega.id,
                nome: entrega.cliente_nome,
                pedido: entrega.numero_pedido,
                turno: entrega.turno || "Comercial",
                timestamp: Date.now()
            };

            filaEspera[tel] = dadosEntrega;
            mapaEntregas[chatId] = dadosEntrega;

            // --- LÓGICA DE HORÁRIOS ---
            let horarioTexto = "entre 08:00 e 18:00";

            if (entrega.turno?.toLowerCase().includes("manh")) {
                horarioTexto = "entre 08:00 e 13:00";
            } else if (entrega.turno?.toLowerCase().includes("tarde")) {
                horarioTexto = "entre 13:00 e 18:00";
            }

            // --- FORMATAR DATA (com timezone correto) ---
            let dataTexto = "em breve";
            if (entrega.data_agendada) {
                try {
                    // Parse da data corretamente (pode vir YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)
                    const dataStr = entrega.data_agendada.split('T')[0]; // Pega só a data
                    const partes = dataStr.split('-');

                    if (partes.length === 3) {
                        const [ano, mes, dia] = partes.map(Number);
                        const dataEntrega = new Date(ano, mes - 1, dia);

                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const amanha = new Date(hoje);
                        amanha.setDate(amanha.getDate() + 1);

                        dataEntrega.setHours(0, 0, 0, 0);

                        if (dataEntrega.getTime() === hoje.getTime()) {
                            dataTexto = "HOJE";
                        } else if (dataEntrega.getTime() === amanha.getTime()) {
                            dataTexto = "AMANHÃ";
                        } else {
                            const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                            const diaSemana = diasSemana[dataEntrega.getDay()] || 'Dia';
                            const diaStr = dia.toString().padStart(2, '0');
                            const mesStr = mes.toString().padStart(2, '0');
                            dataTexto = `${diaSemana.toUpperCase()}, ${diaStr}/${mesStr}`;
                        }
                    }
                } catch (e) {
                    console.log('Erro ao parsear data:', e.message);
                    dataTexto = "em breve";
                }
            }

            // ✅ MENSAGEM DE ENTREGA CONFIRMADA
            const mensagem =
                `Olá *${entrega.cliente_nome}*! 👋
Aqui é da *Móveis Pedro II*.

🚚 *Sua entrega está confirmada!*

📦 Pedido: #${entrega.numero_pedido}
📅 Data: *${dataTexto}*
🕐 Horário: *${horarioTexto}*

*O que você vai receber:*
${entrega.produtos || "Móveis diversos"}

✅ Tudo certo por aqui! Nossa equipe já está preparando seu pedido.

⚠️ *Lembre-se:* É necessário que tenha alguém *maior de idade* no local para receber e conferir os itens.

_O horário pode ter pequenas variações devido ao trânsito._

Qualquer imprevisto, é só responder esta mensagem! 📱`;

            const msgEnviada = await client.sendMessage(chatId, mensagem);
            console.log(`📤 Enviado para ${entrega.cliente_nome} (${chatId})`);

            const chat = await msgEnviada.getChat();
            if (chat.id._serialized !== chatId) {
                mapaEntregas[chat.id._serialized] = dadosEntrega;
            }

        } catch (e) { console.error(`❌ Erro envio: ${e.message}`); }
        await new Promise(r => setTimeout(r, 5000 + Math.random() * 3000));
    }
});

// --- ROTA 2: MENSAGEM PÓS-VENDA (FIDELIZAÇÃO) ---
app.post('/mensagem-pos-venda', async (req, res) => {
    const { telefone, nome, pedido, prazo, produtos, pdf_base64 } = req.body;

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    const mensagem =
        `Olá *${nome}!* 🎉
Muito obrigado por comprar na *Móveis Pedro II*.

✅ *Seu Pedido #${pedido} foi confirmado!*

📦 *Itens do seu pedido:*
${produtos || 'Consulte sua nota de pedido'}

⚠️ *IMPORTANTE:*
Por favor, **salve este número** na sua agenda. É por aqui que vamos te avisar sobre a entrega.

📅 *Prazo:* ${prazo} úteis
Não precisa se preocupar em ligar! Quando seu pedido já tiver uma rota pronta, entraremos em contato para te informar a data da entrega.

Qualquer dúvida, estamos à disposição! 🧡💚`;

    try {
        // 1. Se tiver PDF, enviar primeiro como documento
        if (pdf_base64) {
            console.log(`📦 Recebido PDF base64 para ${nome} (tamanho: ${pdf_base64.length} chars)`);
            try {
                const { MessageMedia } = require('whatsapp-web.js');
                const media = new MessageMedia('application/pdf', pdf_base64, `Pedido_${pedido}.pdf`);
                await client.sendMessage(chatId, media, {
                    caption: `📄 Nota do Pedido #${pedido} - Móveis Pedro II`
                });
                console.log(`📎 PDF enviado para ${nome}`);
            } catch (pdfError) {
                console.error('Erro ao enviar PDF (continuando com mensagem de texto):', pdfError.message);
            }
        }

        // 2. Enviar mensagem de texto
        await client.sendMessage(chatId, mensagem);
        console.log(`✅ Pós-venda enviado para ${nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro zap:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 3: INÍCIO DE ROTA (LOGÍSTICA) ---
app.post('/aviso-inicio-rota', async (req, res) => {
    const { entregas } = req.body;

    console.log(`🚚 Iniciando rota com ${entregas.length} entregas`);
    res.json({ success: true }); // Responde rápido para liberar o front

    for (const entrega of entregas) {
        if (!entrega.cliente_telefone) continue;

        let tel = entrega.cliente_telefone.replace(/\D/g, '');
        if (tel.length < 12) tel = '55' + tel;
        const chatId = `${tel}@c.us`;

        const msg =
            `Bom dia, *${entrega.cliente_nome}*! 🚚

O caminhão da *Móveis Pedro II* acabou de sair do depósito e iniciou a rota de entregas de hoje.

📦 Seu pedido *#${entrega.numero_pedido}* está a caminho!
Por favor, mantenha alguém no local para receber.

Até breve!`;

        try {
            await client.sendMessage(chatId, msg);
            await new Promise(r => setTimeout(r, 3000)); // Delay de 3s entre msgs
        } catch (e) {
            console.error(`Erro ao enviar para ${entrega.cliente_nome}`);
        }
    }
});

// --- ROTA 4: PRÓXIMA PARADA (RASTREAMENTO) ---
app.post('/aviso-proxima-parada', async (req, res) => {
    const { telefone, nome, linkLocalizacao } = req.body;

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    const msg =
        `*Móveis Pedro II Informa:* 📍

Olá *${nome}*! O motorista finalizou a entrega anterior e **você é a próxima parada!**

Prepare-se para receber seus móveis em breve.

👇 *Localização atual do caminhão:*
${linkLocalizacao || "O motorista está a caminho!"}`;

    try {
        await client.sendMessage(chatId, msg);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 5: REAGENDAMENTO DE ENTREGAS ---
app.post('/reagendar-entregas', async (req, res) => {
    const { entregas } = req.body;

    console.log(`📅 Reagendando ${entregas?.length || 0} entregas`);
    res.json({ success: true });

    for (const entrega of (entregas || [])) {
        if (!entrega.telefone) continue;

        let tel = entrega.telefone.replace(/\D/g, '');
        if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
        const chatId = `${tel}@c.us`;

        const msg =
            `Olá *${entrega.nome}*! 😔

Pedimos desculpas, mas *ocorreu um imprevisto* e precisaremos reagendar a sua entrega.

📦 Pedido: *#${entrega.numero_pedido}*

Fique tranquilo(a)! O reagendamento será feito dentro do prazo original do seu pedido.

Nossa equipe entrará em contato em breve para confirmar a nova data da entrega.

Pedimos desculpas pelo inconveniente. 🙏
*Móveis Pedro II*`;

        try {
            await client.sendMessage(chatId, msg);
            console.log(`📅 Reagendamento enviado para ${entrega.nome}`);
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.error(`Erro ao enviar reagendamento para ${entrega.nome}`);
        }
    }
});

// --- ROTA 6: ENTREGA NÃO REALIZADA (FALHA) ---
app.post('/entrega-nao-realizada', async (req, res) => {
    const { telefone, nome, numero_pedido, motivo } = req.body;

    if (!telefone) {
        return res.status(400).json({ error: "telefone é obrigatório" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    const msg =
        `Olá *${nome}*! 😔

Nossos entregadores estiveram no endereço hoje, mas *não conseguimos realizar a entrega* do seu pedido *#${numero_pedido}*.

${motivo ? `📝 Motivo: ${motivo}` : ''}

O pedido está retornando ao nosso depósito e faremos uma *nova tentativa de entrega em breve*.

Nossa equipe entrará em contato para reagendar uma data conveniente para você.

Caso tenha alguma dúvida, responda esta mensagem!

*Móveis Pedro II* 🧡💚`;

    try {
        await client.sendMessage(chatId, msg);
        console.log(`❌ Aviso de falha enviado para ${nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error(`Erro ao enviar falha para ${nome}`);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 7: MENSAGEM DE MARKETING (RECUPERAÇÃO DE ORÇAMENTOS) ---
app.post('/enviar-mensagem-marketing', async (req, res) => {
    const { telefone, nome, tipo, dados_extras } = req.body;

    if (!telefone || !nome || !tipo) {
        return res.status(400).json({ error: "telefone, nome e tipo são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    let mensagem = "";

    if (tipo === "recuperacao") {
        // Mensagem de recuperação de orçamento
        const valor = dados_extras?.valor ?
            parseFloat(dados_extras.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) :
            "em aberto";

        mensagem =
            `Olá *${nome}*!
Aqui é da *Móveis Pedro II*.

Vi que você fez um orçamento conosco de *${valor}* e ainda não fechou. 📋

🎯 Conseguimos manter as condições especiais se você fechar até hoje!

Posso te ajudar a finalizar a compra? 
Estou à disposição para tirar qualquer dúvida! 😊`;

    } else {
        return res.status(400).json({ error: "Tipo de mensagem inválido. Use: recuperacao" });
    }

    try {
        await client.sendMessage(chatId, mensagem);
        console.log(`📣 Marketing (${tipo}) enviado para ${nome}`);
        res.json({ success: true, tipo, nome });
    } catch (e) {
        console.error("Erro zap marketing:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 6: MENSAGEM DE ANIVERSÁRIO AUTOMÁTICA (NOVA!) ---
app.post('/enviar-mensagem-aniversario', async (req, res) => {
    const { telefone, nome, cupom_codigo, lojas } = req.body;

    if (!telefone || !nome || !cupom_codigo) {
        return res.status(400).json({ error: "telefone, nome e cupom_codigo são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    // Formatar endereços das lojas
    let enderecos = '';
    if (lojas && lojas.length > 0) {
        enderecos = '\n *Venha nos visitar:*\n\n';
        lojas.forEach(loja => {
            const endereco = `${loja.endereco || ''}${loja.numero ? ', ' + loja.numero : ''}${loja.bairro ? ' - ' + loja.bairro : ''}`;
            const cidadeEstado = `${loja.cidade || ''}${loja.estado ? '/' + loja.estado : ''}`;
            enderecos += `📍 *${loja.nome}*\n${endereco}\n${cidadeEstado}\n`;
        });
    }

    const mensagem =
        `Olá *${nome}*! 🎂🎉

A equipe da *Móveis Pedro II* deseja um FELIZ ANIVERSÁRIO!

Para celebrar seu dia especial, preparamos um presente exclusivo:
💜 *10% de desconto* na sua próxima compra!

🎁 Use o cupom: *${cupom_codigo}*
_⚠️ Apresente este cupom no balcão da loja junto com uma documentação sua!_
_✨ Válido por 30 dias_
${enderecos}
Um grande abraço! 🧡💚`;

    try {
        await client.sendMessage(chatId, mensagem);
        console.log(`🎂 Aniversário enviado para ${nome} (${cupom_codigo})`);
        res.json({ success: true, nome, cupom: cupom_codigo });
    } catch (e) {
        console.error("Erro zap aniversário:", e);
        res.status(500).json({ error: e.message });
    }
});

// Função auxiliar para obter a chave (Env ou Banco)
async function getGeminiApiKey() {
    // 1. Tentar Environment (Prioridade para Dev/Override)
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

    try {
        const { data, error } = await supabase
            .from("configuracao_sistema")
            .select("dados")
            .eq("tipo", "integracoes")
            .single();

        if (error || !data?.dados?.gemini_api_key) {
            console.warn("Chave Gemini não encontrada no banco de dados");
            return null;
        }
        return data.dados.gemini_api_key;
    } catch (e) {
        console.error("Erro ao buscar chave Gemini no banco:", e);
        return null;
    }
}

// --- ROTA 7: BUSCA DE PRODUTO COM IA (PARA CADASTRO RÁPIDO) ---
app.post('/buscar-produto-ia', async (req, res) => {
    const { busca } = req.body;

    if (!busca || !busca.trim()) {
        return res.status(400).json({ error: "Campo 'busca' é obrigatório" });
    }

    try {
        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
            return res.status(500).json({ error: "Chave da API Gemini não configurada (Verifique Configurações > Integrações)" });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Busque informações EXATAS sobre este produto de móveis:
"${busca}"

FONTES OBRIGATÓRIAS (priorize sites brasileiros):
- MadeiraMadeira.com.br
- Mobly.com.br
- TokStok.com.br
- CasasBahia.com.br
- Lojas Americanas
- Sites de fabricantes brasileiros de móveis

REGRAS CRÍTICAS:
1. Se NÃO encontrar informações confiáveis, retorne {} (objeto vazio)
2. NUNCA invente dimensões, preços ou características
3. Use apenas informações que você TEM CERTEZA que são sobre ESTE PRODUTO ESPECÍFICO
4. Se houver qualquer dúvida, retorne {}

Retorne JSON apenas se encontrar com CERTEZA:
{
  "nome": "nome completo do produto incluindo marca/modelo",
  "categoria": "uma das opções: Sofá, Cama, Mesa, Cadeira, Armário, Estante, Rack, Poltrona, Escrivaninha, Criado-mudo, Buffet, Aparador, Banco, Outros",
  "material": "material principal real (Madeira, MDF, Metal, Vidro, Tecido, Couro, etc) ou null",
  "cor": "cor principal do produto ou null",
  "descricao": "descrição detalhada APENAS com informações que você ENCONTROU",
  "largura": número em cm ou null,
  "altura": número em cm ou null,
  "profundidade": número em cm ou null,
  "confianca": "alta" | "media" | "baixa"
}

EXEMPLO BOM (encontrou):
{
  "nome": "Sofá Retrátil 3 Lugares Suede Marrom - Império Móveis",
  "categoria": "Sofá",
  "material": "Suede",
  "cor": "Marrom",
  "descricao": "Sofá retrátil e reclinável para 3 pessoas, estrutura em madeira, revestimento em suede",
  "largura": 230,
  "altura": 90,
  "profundidade": 95,
  "confianca": "alta"
}

EXEMPLO RUIM (não encontrou ou incerto):
{}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        try {
            // Limpeza básica de markdown se houver
            const cleanJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
            const jsonData = JSON.parse(cleanJson);
            res.json(jsonData);
        } catch (parseError) {
            console.error("Erro ao parsear resposta da IA:", parseError);
            res.json({});
        }

    } catch (error) {
        console.error("Erro ao buscar produto com IA:", error);
        res.status(500).json({ error: "Erro ao processar solicitação: " + error.message });
    }
});

// --- ROTA 8: AVISO DE MONTAGEM AGENDADA (COM CONTATO DO MONTADOR) ---
app.post('/aviso-montagem-agendada', async (req, res) => {
    const { telefone, cliente_nome, numero_pedido, produto_nome, data_formatada, turno, montador_nome, montador_telefone } = req.body;

    if (!telefone || !cliente_nome) {
        return res.status(400).json({ error: "telefone e cliente_nome são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    // Formatar telefone do montador para link WhatsApp
    const telMontador = montador_telefone?.replace(/\D/g, '') || '';
    const linkMontador = telMontador ? `wa.me/55${telMontador}` : '';

    const msg =
        `Olá *${cliente_nome}*! 🛠️

Sua *montagem* do pedido *#${numero_pedido}* foi agendada!

📅 *Data:* ${data_formatada}
🕐 *Turno:* ${turno || "Horário comercial"}
📦 *Item:* ${produto_nome || "Seus móveis"}

👷 *Montador:* ${montador_nome || "Nosso montador"}
${linkMontador ? `📱 *Contato direto:* ${linkMontador}` : ''}

💡 *Precisa reagendar?*
Entre em contato diretamente com o montador pelo WhatsApp acima. Ele tem autonomia para ajustar a data e horário conforme sua disponibilidade.

⚠️ Por favor, certifique-se de que haverá alguém no local para receber.

*Móveis Pedro II* 🧡💚`;

    try {
        await client.sendMessage(chatId, msg);
        console.log(`🔧 Aviso de montagem agendada enviado para ${cliente_nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao enviar aviso de montagem:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 8B: CONFIRMAR MONTAGEM (LEGADO - MANTIDO POR COMPATIBILIDADE) ---
app.post('/confirmar-montagem', async (req, res) => {
    const { telefone, nome, data, horario, montador_nome } = req.body;

    if (!telefone || !nome) {
        return res.status(400).json({ error: "telefone e nome são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    // Formatar data
    let dataFormatada = "em breve";
    if (data) {
        const dataObj = new Date(data);
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const diaSemana = diasSemana[dataObj.getDay()];
        const dia = dataObj.getDate().toString().padStart(2, '0');
        const mes = (dataObj.getMonth() + 1).toString().padStart(2, '0');
        dataFormatada = `${diaSemana}, ${dia}/${mes}`;
    }

    const msg =
        `Olá *${nome}*! 🔧

Sua *montagem* foi confirmada!

📅 Data: *${dataFormatada}*
🕐 Horário: *${horario || "A confirmar"}*
👷 Montador: *${montador_nome || "Nosso montador"}*

⚠️ Por favor, certifique-se de que haverá alguém no local para receber o montador.

Qualquer dúvida, estamos à disposição!
*Móveis Pedro II* 🧡💚`;

    try {
        await client.sendMessage(chatId, msg);
        console.log(`🔧 Confirmação de montagem enviada para ${nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao enviar confirmação de montagem:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 9: LEMBRETE DE MONTAGEM (CRON - 8H DA MANHÃ) ---
app.post('/lembrete-montagem', async (req, res) => {
    const { telefone, nome, horario } = req.body;

    if (!telefone || !nome) {
        return res.status(400).json({ error: "telefone e nome são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    const msg =
        `Bom dia, *${nome}*! ☀️

Hoje é o dia da sua *montagem*!

🕐 Horário previsto: *${horario || "Horário comercial"}*

O montador chegará em breve. Por favor, mantenha alguém no local para receber.

Se precisar de algo, responda esta mensagem!
*Móveis Pedro II* 🧡💚`;

    try {
        await client.sendMessage(chatId, msg);
        console.log(`☀️ Lembrete de montagem enviado para ${nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao enviar lembrete de montagem:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ROTA 10: MONTADOR A CAMINHO ---
app.post('/montador-a-caminho', async (req, res) => {
    const { telefone, nome } = req.body;

    if (!telefone || !nome) {
        return res.status(400).json({ error: "telefone e nome são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    const msg =
        `Olá *${nome}*! 🚗

O montador está *a caminho* do seu endereço!

Previsão de chegada: *em breve*

Por favor, aguarde no local indicado.

*Móveis Pedro II* 🧡💚`;

    try {
        await client.sendMessage(chatId, msg);
        console.log(`🚗 Montador a caminho notificado para ${nome}`);
        res.json({ success: true });
    } catch (e) {
        console.error("Erro ao enviar montador a caminho:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- OUVINTE DE RESPOSTAS (IA) - NOVA LÓGICA ---
client.on('message', async msg => {
    if (msg.from.includes('@g.us') || msg.isStatus) return;

    let entrega = mapaEntregas[msg.from];
    if (!entrega) {
        const tel = msg.from.replace(/\D/g, '');
        const raiz = tel.slice(-8);
        const key = Object.keys(filaEspera).find(k => k.endsWith(raiz));
        if (key) entrega = filaEspera[key];
    }

    if (!entrega) return;

    console.log(`💡 ${entrega.nome} respondeu ao informativo de entrega...`);

    try {
        let parts = [];
        if (msg.type === 'ptt' || msg.type === 'audio') {
            console.log("🎙️ Baixando áudio...");
            const media = await msg.downloadMedia();
            parts.push({ inlineData: { mimeType: media.mimetype, data: media.data } });
            parts.push({ text: `Analise este áudio.` });
        } else if (msg.type === 'chat') {
            parts.push({ text: `Cliente disse: "${msg.body}"` });
        } else { return; }

        // ✅ NOVA LÓGICA DE CLASSIFICAÇÃO
        const prompt = `
        Contexto: O cliente ${entrega.nome} recebeu um INFORMATIVO de entrega do pedido #${entrega.pedido} para AMANHÃ (${entrega.turno}).
        A mensagem NÃO pediu confirmação, apenas informou. O cliente está respondendo agora.
        
        TAREFA: Classifique a resposta em UMA das 3 categorias. Retorne APENAS JSON válido.
        
        Formato: { "categoria": "CIENTE" | "PROBLEMA" | "DUVIDA", "resumo": "breve resumo", "resposta_zap": "mensagem para enviar" }
        
        REGRAS DE CLASSIFICAÇÃO:
        
        1. CIENTE: Cliente demonstrou que entendeu/aceitou a entrega.
           - Exemplos: "Ok", "Tá bom", "Obrigado", "Certo", "Beleza", "Pode ser", "Estarei em casa".
           - resposta_zap: "Perfeito! Agradecemos o retorno. Qualquer novidade, avisamos! 🚚✅"
        
        2. PROBLEMA: Cliente sinalizou que NÃO pode/vai receber.
           - Exemplos: "Não vou estar", "Viajei", "Não posso", "Preciso trocar o dia", "Não tenho como receber".
           - resposta_zap: "Entendido. Vou avisar a equipe de logística imediatamente para reagendarmos. Aguarde nosso contato! 📞"
        
        3. DUVIDA: Cliente fez perguntas sobre horário, montagem, pagamento, etc.
           - Exemplos: "Que horas mais ou menos?", "Vocês montam?", "Posso pagar na entrega?".
           - resposta_zap: "Boa pergunta! Um atendente humano vai te responder em breve. Por favor, aguarde. 🙂"
        `;

        parts.push({ text: prompt });

        // Retry com backoff para rate limits
        let result;
        let tentativas = 0;
        const maxTentativas = 3;

        while (tentativas < maxTentativas) {
            try {
                result = await model.generateContent(parts);
                break; // Sucesso, sair do loop
            } catch (apiError) {
                tentativas++;
                if (apiError.status === 429 && tentativas < maxTentativas) {
                    console.log(`⏳ Rate limit, aguardando ${tentativas * 2}s...`);
                    await new Promise(r => setTimeout(r, tentativas * 2000));
                } else if (apiError.status === 429) {
                    // Quota excedida - usar fallback
                    console.log(`⚠️ Quota Gemini excedida, usando resposta padrão...`);
                    result = null;
                    break;
                } else {
                    // Outro erro - usar fallback também
                    console.log(`⚠️ Erro na IA: ${apiError.message}, usando resposta padrão...`);
                    result = null;
                    break;
                }
            }
        }

        if (!result) {
            // Se não conseguiu após retries, responde com mensagem padrão gentil
            await msg.reply(`Recebemos sua mensagem, ${dados.nome?.split(' ')[0] || 'cliente'}! 🙂\n\nUm atendente vai confirmar sua entrega em breve. Obrigado pela resposta!`);

            // Atualizar no banco como "Requer Atenção" para alguém ver
            try {
                await supabase
                    .from('entregas')
                    .update({
                        status_confirmacao: 'Requer Atenção',
                        observacoes: 'Cliente respondeu - aguardando análise manual'
                    })
                    .eq('id', dados.id);
            } catch (e) { console.log('Erro ao atualizar:', e.message); }
            return;
        }

        const analise = limparJSON(result.response.text());

        if (!analise) throw new Error("Falha JSON IA");

        // Mapear categoria para status do sistema
        let statusSistema = 'Confirmada';
        let acaoExtra = null;

        if (analise.categoria === "CIENTE") {
            statusSistema = 'Confirmada';
        } else if (analise.categoria === "PROBLEMA") {
            statusSistema = 'Ressalva'; // ⚠️ NOVO STATUS - Alerta visual no sistema
            acaoExtra = 'CLIENTE NÃO PODE RECEBER - REAGENDAR';
        } else if (analise.categoria === "DUVIDA") {
            statusSistema = 'Requer Atenção';
        }

        console.log(`🤖 IA: ${analise.categoria} -> Status: ${statusSistema}`);

        // Atualizar Supabase diretamente
        const updateData = {
            status: statusSistema,
            observacoes: acaoExtra || analise.resumo
        };

        const { error } = await supabase
            .from('entregas')
            .update(updateData)
            .eq('id', entrega.id);

        if (!error) {
            console.log(`✅ Supabase atualizado: ${statusSistema}`);
        } else {
            console.error(`⚠️ Erro Supabase: ${error.message}`);
        }

        // Responder ao cliente
        await msg.reply(analise.resposta_zap);

        // Limpar da fila
        delete mapaEntregas[msg.from];
        const tel = msg.from.replace(/\D/g, '');
        const key = Object.keys(filaEspera).find(k => k.endsWith(tel.slice(-8)));
        if (key) delete filaEspera[key];

    } catch (e) {
        console.error("Erro Geral:", e);
        // Resposta fallback em caso de erro persistente
        try {
            await msg.reply("Recebemos sua mensagem! Um atendente vai te responder em breve. 🙂");
        } catch (replyError) {
            console.error("Erro ao enviar fallback:", replyError);
        }
    }
});

// --- ROTA PROXY: DOWNLOAD DE XML NFE (EVITA CORS) ---
app.get('/nfe-xml/:documentoId', async (req, res) => {
    const { documentoId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
    }

    try {
        // Faz a requisicao para a API Nuvem Fiscal
        const response = await fetch(`https://api.nuvemfiscal.com.br/distribuicao/nfe/documentos/${documentoId}/xml`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            redirect: 'follow' // Segue o redirect para o S3
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: "Erro ao baixar XML" });
        }

        const xmlContent = await response.text();
        res.set('Content-Type', 'application/xml');
        res.send(xmlContent);

    } catch (error) {
        console.error("Erro no proxy NFe:", error);
        res.status(500).json({ error: error.message });
    }
});

// Limpeza de filas antigas (24h)
setInterval(() => {
    const agora = Date.now();
    for (const [k, v] of Object.entries(filaEspera)) if (agora - v.timestamp > 86400000) delete filaEspera[k];
    for (const [k, v] of Object.entries(mapaEntregas)) if (agora - v.timestamp > 86400000) delete mapaEntregas[k];
}, 3600000);

// === SISTEMA DE ANIVERSÁRIOS AUTOMÁTICO ===
require('./cron-aniversarios');

// === SISTEMA DE LEMBRETES DE MONTAGEM ===
require('./cron-montagens');

client.initialize();
// 🏗️ CATCH-ALL ROUTE (React Router)
// Return index.html for any unknown route so React handles routing
app.get('*', (req, res, next) => {
    // If request marks itself as API (starts with /whatsapp or /nfe-xml), skip to error handler 
    // (though express usually handles this by matching specific routes first)
    if (req.path.startsWith('/whatsapp') || req.path.startsWith('/nfe-xml')) {
        return next();
    }
    const indexPath = path.join(__dirname, '../dist/index.html');
    // Check if file exists before sending to avoid crashing if build is missing
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next(); // Fallback to error handler or 404
    }
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error("🔥 Erro não tratado:", err);
    res.status(500).json({ error: "Erro interno do servidor", details: err.message });
});

app.listen(PORT, () => console.log(`🛡️ Servidor rodando na porta ${PORT}`));
