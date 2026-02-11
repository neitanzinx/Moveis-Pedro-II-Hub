const path = require("path");
const fs = require("fs");
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

// 🔐 Rotas de Autenticação de Funcionários
const { setupEmployeeAuthRoutes } = require('./routes/authEmployee');

const app = express();
const port = process.env.PORT || 3001;

// 🛡️ Bulletproof CORS: Allow ALL origins.
app.use(cors());

// 🛡️ Global Crash Prevention
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL ERROR (Uncaught):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = reason?.message || String(reason);
    // Auth timeout é esperado quando a sessão WhatsApp expira — não é crítico
    if (msg.includes('auth timeout') || msg.includes('Navigation timeout') || msg.includes('Protocol error')) {
        console.warn('⚠️ WhatsApp auth/timeout error (sessão expirada — será reconectado):', msg);
    } else {
        console.error('🔥 CRITICAL ERROR (Unhandled Rejection):', reason);
    }
});

// Aumentar limite de listeners
require('events').EventEmitter.defaultMaxListeners = 20;
// Aumentar limite do body para suportar PDF base64 (~200KB+)
app.use(express.json({ limit: '10mb' }));

// 🔐 As rotas de autenticação de funcionários são registradas após a inicialização do client WhatsApp

// 🏗️ SERVE FRONTEND (Monolith Mode)
// Serves static files from the React build folder
// Works both locally (../dist) and in Docker (/app/dist)
const distPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'dist')  // Docker: /app/dist
    : path.join(__dirname, '../dist'); // Local: robo.../dist -> root/dist
app.use(express.static(distPath));

// const genAI = new GoogleGenerativeAI(GEMINI_KEY); // Movido para dentro da rota
// const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// =============================================================================
// 🤖 WHATSAPP MANAGER — Gerenciador de Ciclo de Vida Resiliente
// =============================================================================

// 🏭 FACTORY: Cria Client NOVO a cada tentativa.
// Motivo: whatsapp-web.js NÃO suporta reinicializar o mesmo objeto Client
// após destroy(). O Puppeteer interno mantém referências ao browser antigo.
// 🏭 FACTORY: Cria Client NOVO a cada tentativa.
function createWhatsAppClient() {
    // 🛡️ Caminhos absolutos para evitar ambiguidade no Docker
    const sessionPath = path.resolve(__dirname, '.wwebjs_auth');
    const cachePath = path.resolve(__dirname, '.wwebjs_cache');

    const puppeteer = require('puppeteer'); // Require local para garantir execução
    console.log('Browser Path:', puppeteer.executablePath());

    return new Client({
        authStrategy: new LocalAuth({
            clientId: "client-one",
            dataPath: sessionPath
        }),
        puppeteer: {
            headless: true,
            executablePath: puppeteer.executablePath(),
            // userDataDir: sessionPath, // REMOVIDO: LocalAuth gerencia isso internamente
            protocolTimeout: 180000,
            dumpio: false, // Voltando ao normal
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ],
            timeout: 180000,
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false
        }
    });
}


// --- Estado global de conexão ---
let connectionStatus = 'disconnected';
let currentQR = null;
let connectionInfo = null;

// -- Client WhatsApp (LET porque precisa ser recriado) ---
let client = createWhatsAppClient();

// 🔗 Registrar event handlers no client atual
function attachClientEvents(c) {
    c.on('qr', qr => {
        currentQR = qr;
        connectionStatus = 'waiting_qr';
        qrcode.generate(qr, { small: true });
        console.log('📱 QR Code gerado - escaneie pelo celular ou pela interface web');
    });

    c.on('authenticated', async () => {
        console.log('🔐 Autenticação bem-sucedida!');
        connectionStatus = 'connected';
        currentQR = null;
        whatsapp.reconnectAttempts = 0;
        whatsapp.disconnectedSince = null;
        whatsapp.isInitializing = false; // ← Liberar trava de init
        try {
            const info = await client.info;
            if (info) {
                connectionInfo = {
                    wid: info.wid?.user || 'N/A',
                    pushname: info.pushname || 'WhatsApp Bot',
                    platform: info.platform || 'unknown'
                };
            }
        } catch (e) {
            console.log('⚠️ Info do usuário indisponível, mas autenticado.');
        }
    });

    c.on('loading_screen', async (percent, message) => {
        console.log(`📶 Carregando WhatsApp: ${percent}% - ${message}`);
        if (percent >= 100 && connectionStatus !== 'connected') {
            console.log('⏳ Aguardando evento ready (3s timeout)...');
            setTimeout(async () => {
                if (connectionStatus !== 'connected') {
                    console.log('⚠️ Evento ready não disparou, forçando conexão...');
                    currentQR = null;
                    connectionStatus = 'connected';
                    whatsapp.disconnectedSince = null;
                    whatsapp.isInitializing = false; // ← Liberar trava de init
                    try {
                        const info = await client.info;
                        connectionInfo = {
                            wid: info?.wid?.user || 'N/A',
                            pushname: info?.pushname || 'WhatsApp Bot',
                            platform: info?.platform || 'unknown'
                        };
                        console.log(`✅ Robô Online! Conectado como: ${connectionInfo.pushname}`);
                    } catch (e) {
                        connectionInfo = null;
                        console.log('✅ Robô Online!');
                    }
                }
            }, 3000);
        }
    });

    c.on('ready', async () => {
        currentQR = null;
        connectionStatus = 'connected';
        whatsapp.reconnectAttempts = 0;
        whatsapp.disconnectedSince = null;
        whatsapp.lastHeartbeat = new Date().toISOString();
        whatsapp.isInitializing = false; // ← Liberar trava de init
        try {
            const info = await client.info;
            connectionInfo = {
                wid: info?.wid?.user || 'N/A',
                pushname: info?.pushname || 'WhatsApp Bot',
                platform: info?.platform || 'unknown'
            };
            console.log(`✅ Robô Logístico Online! Conectado como: ${connectionInfo.pushname}`);
        } catch (e) {
            connectionInfo = null;
            console.log('✅ Robô Logístico Online!');
        }
    });

    c.on('disconnected', async (reason) => {
        currentQR = null;
        connectionStatus = 'disconnected';
        connectionInfo = null;
        whatsapp.disconnectedSince = whatsapp.disconnectedSince || Date.now();
        console.log('❌ WhatsApp desconectado:', reason);
        whatsapp.isInitializing = false; // ← Liberar trava
        whatsapp.reconnect(`desconexão: ${reason}`);
    });

    c.on('auth_failure', async (msg) => {
        currentQR = null;
        connectionStatus = 'disconnected';
        whatsapp.disconnectedSince = whatsapp.disconnectedSince || Date.now();
        console.log('⚠️ Falha na autenticação:', msg);
        whatsapp.isInitializing = false; // ← Liberar trava
        whatsapp.reconnect(`auth_failure: ${msg}`);
    });
}

// Registrar no client inicial
attachClientEvents(client);

// --- WhatsApp Manager ---
const whatsapp = {
    isReconnecting: false,
    isInitializing: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    watchdogInterval: null,
    watchdogFailures: 0,
    startedAt: null,
    lastHeartbeat: null,
    reconnectCount: 0,
    disconnectedSince: null,

    getBackoffDelay() {
        const delays = [10, 30, 60, 120, 300];
        return (delays[Math.min(this.reconnectAttempts, delays.length - 1)]) * 1000;
    },

    // 💀 Matar Chrome + limpar APENAS lock files (preserva sessão/auth!)
    cleanChrome(deleteSession = false) {
        const { execSync } = require('child_process');
        console.log(`💀 [CLEAN] Matando Chrome... (deleteSession=${deleteSession})`);

        // 1) Matar por nome exato do binário
        for (const name of ['google-chrome-stable', 'chrome', 'chromium', 'chromium-browser']) {
            try { execSync(`killall -9 ${name} 2>/dev/null`, { stdio: 'ignore', timeout: 5000 }); } catch (e) { /* ok */ }
        }

        // 2) Fallback por PID individual
        try {
            const pids = execSync('pgrep -f "google-chrome|chromium" 2>/dev/null || true', { encoding: 'utf8', timeout: 3000 }).trim();
            if (pids) {
                for (const pid of pids.split('\n').filter(p => p.trim())) {
                    const pidNum = parseInt(pid.trim());
                    if (pidNum > 1 && pidNum !== process.pid) {
                        try { execSync(`kill -9 ${pidNum} 2>/dev/null`, { stdio: 'ignore', timeout: 1000 }); } catch (e) { /* ok */ }
                    }
                }
            }
        } catch (e) { /* ok */ }

        // 3) Esperar
        try { execSync('sleep 2', { stdio: 'ignore' }); } catch (e) { /* ok */ }

        // 4) Limpar lock files (ProcessSingleton) MAS PRESERVAR sessão
        // 4) Limpar lock files (ProcessSingleton) MAS PRESERVAR sessão
        const sessionDir = path.join(__dirname, '.wwebjs_auth', 'session-client-one');
        if (deleteSession) {
            // Modo nuclear: deleta tudo (força QR rescan)
            try {
                console.log(`🧹 [CLEAN] Tentando remover pasta: ${sessionDir}`);
                if (fs.existsSync(sessionDir)) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    console.log('🧹 [CLEAN] Pasta de sessão REMOVIDA (QR será necessário)');
                } else {
                    console.log('🧹 [CLEAN] Pasta de sessão não existia.');
                }
            } catch (e) {
                console.error(`❌ [CLEAN] Falha ao remover pasta de sessão: ${e.message}`);
                try {
                    const files = fs.readdirSync(sessionDir);
                    console.warn(`📂 [CLEAN] Conteúdo restante: ${files.join(', ')}`);
                } catch (e2) { console.warn(`📂 [CLEAN] Não foi possível listar conteúdo.`); }
            }
        } else {
            // Modo suave: apenas remove Chrome lock files
            const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
            if (fs.existsSync(sessionDir)) {
                for (const f of lockFiles) {
                    const fp = path.join(sessionDir, f);
                    try {
                        if (fs.existsSync(fp)) {
                            fs.rmSync(fp, { force: true });
                            console.log(`🧹 [CLEAN] Removido: ${f}`);
                        }
                    } catch (e) {
                        console.error(`❌ [CLEAN] Falha ao remover ${f}: ${e.message}`);
                    }
                }
                // Também limpar Default/SingletonLock se existir
                const defaultDir = path.join(sessionDir, 'Default');
                if (fs.existsSync(defaultDir)) {
                    for (const f of lockFiles) {
                        const fp = path.join(defaultDir, f);
                        try {
                            if (fs.existsSync(fp)) {
                                fs.rmSync(fp, { force: true });
                                console.log(`🧹 [CLEAN] Removido (Default): ${f}`);
                            }
                        } catch (e) { /* silent fail for default dir */ }
                    }
                }
                console.log('🧹 [CLEAN] Lock files verificados (sessão preservada)');
            } else {
                console.log('🧹 [CLEAN] Pasta de sessão não existe, nada a limpar.');
            }
        }

        console.log('✅ [CLEAN] Limpeza concluída');
    },

    // 🔄 Cria novo Client e registra os event handlers
    recreateClient() {
        console.log('🔄 [CLIENT] Criando novo Client...');
        client = createWhatsAppClient();
        attachClientEvents(client);
        return client;
    },

    // 🚀 Inicialização — fire-and-forget com timeout safety
    async initialize() {
        if (this.isInitializing) {
            console.log('⏳ [INIT] Já em andamento.');
            return false;
        }
        this.isInitializing = true;
        this.startedAt = Date.now();

        // Limpar Chrome da execução anterior (preservar sessão!)
        this.cleanChrome(false);
        this.recreateClient();

        connectionStatus = 'initializing';
        console.log('📱 [INIT] Iniciando WhatsApp...');

        // Fire-and-forget: client.initialize() roda em background
        // Os EVENTOS (qr, ready, authenticated) vão atualizar o status
        client.initialize().then(() => {
            console.log('✅ [INIT] client.initialize() resolveu com sucesso');
            this.isInitializing = false;
            this.startWatchdog();
        }).catch(async (err) => {
            console.error('❌ [INIT] client.initialize() falhou:', err); // Log full error object
            if (err.message) console.error('❌ [INIT] Mensagem de erro:', err.message);

            // Destruir client
            try { await client.destroy(); } catch (e) { /* ok */ }

            // Se o status já mudou para waiting_qr ou connected, NÃO reverter
            if (connectionStatus === 'initializing') {
                connectionStatus = 'disconnected';
                this.disconnectedSince = Date.now();
            }

            this.isInitializing = false;

            // Retry automático após 15s se era a primeira tentativa
            if (this.reconnectAttempts < 2) {
                console.log('🔄 [INIT] Retry automático em 15s...');
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.cleanChrome(true); // Nuclear no retry: deletar sessão inteira
                    this.recreateClient();
                    connectionStatus = 'initializing';

                    client.initialize().then(() => {
                        console.log('✅ [INIT] Retry bem-sucedido!');
                        this.isInitializing = false;
                        this.reconnectAttempts = 0;
                        this.startWatchdog();
                    }).catch(async (err2) => {
                        console.error('❌ [INIT] Retry também falhou:', err2.message);
                        try { await client.destroy(); } catch (e) { /* ok */ }
                        if (connectionStatus === 'initializing') {
                            connectionStatus = 'disconnected';
                        }
                        this.isInitializing = false;
                        this.startWatchdog();
                    });
                }, 15000);
            } else {
                this.startWatchdog();
            }
        });

        // Retorna imediatamente — não bloqueia o servidor
        // Safety timeout: se após 2 minutos ainda estiver "initializing", forçar para disconnected
        setTimeout(() => {
            if (connectionStatus === 'initializing') {
                console.warn('⚠️ [INIT] Safety timeout: 2min sem resposta, marcando como disconnected');
                connectionStatus = 'disconnected';
                this.isInitializing = false;
            }
        }, 120000);

        return true;
    },

    // 🔄 Reconexão robusta com backoff exponencial
    async reconnect(reason = 'unknown') {
        if (this.isReconnecting || this.isInitializing) {
            console.log(`⏳ [RECONNECT] Bloqueado (init=${this.isInitializing}, reconn=${this.isReconnecting})`);
            return;
        }

        this.isReconnecting = true;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`⛔ [RECONNECT] Máximo de ${this.maxReconnectAttempts} tentativas.`);
            connectionStatus = 'disconnected';
            this.isReconnecting = false;
            return;
        }

        this.reconnectAttempts++;
        this.reconnectCount++;
        const delay = this.getBackoffDelay();

        console.log(`🔄 [RECONNECT] #${this.reconnectAttempts} (${reason}) em ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));

        this.cleanChrome(false);
        this.recreateClient();
        connectionStatus = 'initializing';

        try {
            await client.initialize();
            console.log('✅ [RECONNECT] Sucesso!');
            this.reconnectAttempts = 0;
            this.disconnectedSince = null;
            this.isReconnecting = false;
        } catch (e) {
            console.error(`❌ [RECONNECT] Falha:`, e.message);
            try { await client.destroy(); } catch (e2) { /* ok */ }

            if (connectionStatus === 'initializing') {
                connectionStatus = 'disconnected';
            }
            this.isReconnecting = false;

            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnect('retry');
            }
        }
    },

    // 🔧 Reconexão manual forçada (via /whatsapp/reconnect)
    async forceReconnect() {
        if (this.isInitializing) {
            return { blocked: true, reason: 'Inicialização em andamento' };
        }

        console.log('🔧 [FORCE] Reconexão manual...');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.watchdogFailures = 0;
        this.isInitializing = true;

        try { await client.destroy(); } catch (e) { /* ok */ }
        this.cleanChrome(true); // Nuclear na reconexão manual
        this.recreateClient();

        connectionStatus = 'initializing';
        currentQR = null;
        connectionInfo = null;

        // Fire-and-forget (eventos vão atualizar o status)
        client.initialize().then(() => {
            console.log('✅ [FORCE] Sucesso!');
            this.disconnectedSince = null;
            this.isInitializing = false;
        }).catch((e) => {
            console.error('❌ [FORCE] Falha:', e.message);
            if (connectionStatus === 'initializing') {
                connectionStatus = 'disconnected';
            }
            this.disconnectedSince = Date.now();
            this.isInitializing = false;
        });

        // Retorna imediato — frontend vai pollar status
        return { blocked: false, success: true, message: 'Inicialização disparada' };
    },

    // 🫀 Watchdog
    startWatchdog() {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);

        const WATCHDOG_INTERVAL = 5 * 60 * 1000;
        const MAX_FAILURES = 3;

        this.watchdogInterval = setInterval(async () => {
            if (this.isReconnecting || this.isInitializing || connectionStatus === 'initializing' || connectionStatus === 'waiting_qr') {
                return;
            }

            try {
                const state = await Promise.race([
                    client.getState(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('watchdog timeout')), 15000))
                ]);

                if (state === 'CONNECTED') {
                    this.watchdogFailures = 0;
                    this.lastHeartbeat = new Date().toISOString();
                    if (connectionStatus !== 'connected') {
                        connectionStatus = 'connected';
                        this.disconnectedSince = null;
                    }
                } else {
                    console.warn(`⚠️ [Watchdog] Estado: ${state}`);
                    this.watchdogFailures++;
                }
            } catch (e) {
                this.watchdogFailures++;
                console.warn(`⚠️ [Watchdog] Falha #${this.watchdogFailures}: ${e.message}`);
            }

            if (this.watchdogFailures >= MAX_FAILURES && !this.isReconnecting) {
                console.error(`🚨 [Watchdog] ${MAX_FAILURES} falhas! Reconectando...`);
                this.watchdogFailures = 0;
                connectionStatus = 'disconnected';
                this.disconnectedSince = this.disconnectedSince || Date.now();
                this.reconnect('watchdog');
            }
        }, WATCHDOG_INTERVAL);

        console.log('🫀 Watchdog iniciado (a cada 5 min)');
    },

    stopWatchdog() {
        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            console.log('🛑 Watchdog parado');
        }
    },

    getHealthData() {
        const now = Date.now();
        return {
            whatsapp: connectionStatus,
            server: 'running',
            uptime_minutes: this.startedAt ? Math.floor((now - this.startedAt) / 60000) : 0,
            reconnect_count: this.reconnectCount,
            offline_minutes: this.disconnectedSince ? Math.floor((now - this.disconnectedSince) / 60000) : 0,
            last_heartbeat: this.lastHeartbeat,
            pid: process.pid,
            memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024)
        };
    }
};

// 🛑 GRACEFUL SHUTDOWN
const shutdown = async (signal) => {
    console.log(`\n${signal} recebido. Encerrando...`);
    whatsapp.stopWatchdog();
    try {
        await client.destroy();
        console.log('✅ Cliente WhatsApp encerrado.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro ao encerrar:', err);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

let filaEspera = {};
let mapaEntregas = {};

// 🔐 Registrar rotas de autenticação de funcionários
setupEmployeeAuthRoutes(app, supabase, client);

function limparJSON(texto) {
    try {
        const inicio = texto.indexOf('{');
        const fim = texto.lastIndexOf('}');
        if (inicio !== -1 && fim !== -1) return JSON.parse(texto.substring(inicio, fim + 1));
        return JSON.parse(texto);
    } catch (e) { return null; }
}

// 🛡️ Enviar mensagem com verificação de conexão
async function enviarMensagemSegura(chatId, content, options = {}) {
    let state;
    try {
        state = await client.getState();
        console.log(`📡 Estado do WhatsApp: ${state}`);
    } catch (stateError) {
        console.error('❌ Erro ao verificar estado:', stateError.message);
    }

    try {
        console.log(`📤 Enviando mensagem para ${chatId}...`);
        const result = await client.sendMessage(chatId, content, options);
        console.log(`✅ Mensagem enviada com SUCESSO para ${chatId}`);
        return { success: true, result };
    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem:`, error.message);
        if (error.message && error.message.includes('markedUnread')) {
            console.log('⚠️ Erro markedUnread detectado');
            return { success: true, warning: 'markedUnread - verifique manualmente' };
        }
        throw error;
    }
}

// 📡 Event handlers são registrados via attachClientEvents() no factory
// Não registrar inline aqui pois o `client` é recriado a cada tentativa

// --- ROTA DE HEALTH CHECK (RENDER) ---
app.get('/', (req, res) => res.status(200).send('Bot is running! 🚀'));

// --- ROTA DE STATUS GERAL ---
app.get('/status', (req, res) => res.json({ status: 'online' }));

// --- ROTA DE HEALTH CHECK INTELIGENTE (para Docker) ---
app.get('/whatsapp/health', (req, res) => {
    const health = whatsapp.getHealthData();
    // Se WhatsApp estiver offline há mais de 10 minutos, retorna 503
    // Docker healthcheck vai captar isso e reiniciar o container
    const isHealthy = health.whatsapp === 'connected' || health.offline_minutes < 10;
    res.status(isHealthy ? 200 : 503).json(health);
});

// --- LOG CAPTURE SYSTEM (IN-MEMORY) ---
const MAX_LOGS = 100;
const memoryLogs = [];

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function captureLog(type, args) {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8); // HH:mm:ss
    memoryLogs.unshift(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.pop();
}

console.log = (...args) => { changeLog: captureLog('info', args); originalConsoleLog.apply(console, args); };
console.error = (...args) => { changeLog: captureLog('error', args); originalConsoleError.apply(console, args); };
console.warn = (...args) => { changeLog: captureLog('warn', args); originalConsoleWarn.apply(console, args); };

// --- ROTA DE STATUS DO WHATSAPP (PARA A INTERFACE) ---
app.get('/whatsapp/status', async (req, res) => {
    // Tentar recuperar info se estiver conectado mas sem dados
    if (connectionStatus === 'connected' && (!connectionInfo || connectionInfo.wid === 'N/A')) {
        try {
            const info = await client.info;
            if (info) {
                connectionInfo = {
                    wid: info.wid?.user || 'N/A',
                    pushname: info.pushname || 'WhatsApp Bot',
                    platform: info.platform || 'unknown'
                };
            }
        } catch (e) { /* ignore */ }
    }

    res.json({
        status: connectionStatus,
        qr: currentQR,
        info: connectionInfo
    });
});

// --- ROTA DE LOGS (DEBUG) ---
app.get('/logs', (req, res) => {
    res.json(memoryLogs);
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
    // Se init já está rodando, informar imediatamente
    if (whatsapp.isInitializing) {
        return res.status(409).json({
            success: false,
            message: 'Inicialização já em andamento. Aguarde.'
        });
    }
    // Responde imediatamente — o reconnect roda em background
    res.json({ success: true, message: 'Reconexão iniciada em background' });
    // Executa em background (não bloqueia a response)
    whatsapp.forceReconnect().catch(e => {
        console.error('❌ Erro na reconexão forçada:', e.message);
    });
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
                    // Parse seguro da data agendada (YYYY-MM-DD)
                    const dataStr = entrega.data_agendada.split('T')[0];

                    // Data de Hoje (Fuso BR)
                    const now = new Date();
                    const hojeStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');

                    // Data de Amanhã (Fuso BR)
                    const amanha = new Date(now);
                    amanha.setDate(amanha.getDate() + 1);
                    const amanhaStr = amanha.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');

                    if (dataStr === hojeStr) {
                        dataTexto = "HOJE";
                    } else if (dataStr === amanhaStr) {
                        dataTexto = "AMANHÃ";
                    } else {
                        // Formato dd/mm
                        const [ano, mes, dia] = dataStr.split('-');
                        dataTexto = `${dia}/${mes}`;
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

    // VALIDAÇÃO: Tentar enviar mesmo se o status interno estiver desincronizado
    // O helper enviarMensagemSegura fará a validação real
    if (connectionStatus !== 'connected') {
        console.warn(`⚠️ Status interno mostra '${connectionStatus}', mas tentando enviar mensagem mesmo assim...`);
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    console.log(`📤 Tentando enviar mensagem para ${nome} (${chatId})`);

    const isRetirada = prazo && (prazo.toLowerCase().includes('retirada') || prazo.toLowerCase().includes('retirado'));

    let mensagem;

    if (isRetirada) {
        mensagem =
            `Olá *${nome}!* 🎉\n` +
            `Muito obrigado por comprar na *Móveis Pedro II*.\n\n` +
            `✅ *Seu Pedido #${pedido} foi confirmado!* \n\n` +
            `📦 *Itens do seu pedido:*\n` +
            `${produtos || 'Consulte sua nota de pedido'}\n\n` +
            `Esperamos que você aproveite muito sua compra! 😍\n\n` +
            `Qualquer dúvida, estamos à disposição! 🧡💚`;
    } else {
        mensagem =
            `Olá *${nome}!* 🎉\n` +
            `Muito obrigado por comprar na *Móveis Pedro II*.\n\n` +
            `✅ *Seu Pedido #${pedido} foi confirmado!* \n\n` +
            `📦 *Itens do seu pedido:*\n` +
            `${produtos || 'Consulte sua nota de pedido'}\n\n` +
            `⚠️ *IMPORTANTE:*\n` +
            `Por favor, **salve este número** na sua agenda. É por aqui que vamos te avisar sobre a entrega.\n\n` +
            `📅 *Prazo:* ${prazo} úteis\n` +
            `Não precisa se preocupar em ligar! Quando seu pedido já tiver uma rota pronta, entraremos em contato para te informar a data da entrega.\n\n` +
            `Qualquer dúvida, estamos à disposição! 🧡💚`;
    }

    try {
        // Enviar mensagem de texto
        const msgResult = await enviarMensagemSegura(chatId, mensagem);
        console.log(`✅ Pós-venda enviado para ${nome}:`, msgResult.success ? 'OK' : msgResult.warning || 'Falha');
        res.json({ success: true, warning: msgResult.warning });
    } catch (e) {
        console.error("❌ Erro ao enviar zap:", e.message);
        console.error("Stack:", e.stack);
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
    const { id, telefone, nome } = req.body;

    if (!id || !telefone) {
        return res.status(400).json({ error: "id da entrega e telefone são obrigatórios" });
    }

    let tel = telefone.replace(/\D/g, '');
    if (tel.length >= 10 && tel.length <= 11) tel = '55' + tel;
    const chatId = `${tel}@c.us`;

    // URL da Landing Page (ajuste se o domínio for diferente)
    const baseUrl = process.env.PUBLIC_URL || "https://moveispedroii.com.br";
    const linkRastreio = `${baseUrl}/rastreio/${id}`;

    const msg =
        `*Móveis Pedro II Informa:* 📍

Olá *${nome}*! O motorista finalizou a entrega anterior e **você é a próxima parada!**

Prepare-se para receber seus móveis em breve.

👇 *Acompanhe a localização do caminhão ao vivo:*
${linkRastreio}`;

    try {
        const result = await enviarMensagemSegura(chatId, msg);
        res.json({ success: true, link: linkRastreio });
    } catch (e) {
        console.error("Erro ao enviar aviso de próxima parada:", e.message);
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

/* 
// --- OUVINTE DE RESPOSTAS (IA) - DESATIVADO (MODO APENAS INFORMATIVO) ---
client.on('message', async msg => {
    // Lógica desativada a pedido do usuário. 
    // O bot agora funciona apenas para disparos ativos.
});
*/

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
// 🏗️ CATCH-ALL MIDDLEWARE MOVED TO END


// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error("🔥 Erro não tratado:", err);
    res.status(500).json({ error: "Erro interno do servidor", details: err.message });
});

// --- ROTA 11: CONCLUIR ENTREGA E AVISAR PRÓXIMO (AUTOMÁTICO) ---
app.post('/concluir-entrega', async (req, res) => {
    const { id_concluida } = req.body;

    if (!id_concluida) {
        return res.status(400).json({ error: "ID da entrega concluída é obrigatório" });
    }

    try {
        // 1. Marcar a atual como concluída no Supabase salvando os dados do front
        const updatePayload = {
            status: 'Concluída',
            data_entrega: new Date().toISOString(),
            ...(req.body.update_data || {}) // Inclui fotos, assinatura, geolocalização
        };

        const { data: entregaAtual, error: err1 } = await supabase
            .from('entregas')
            .update(updatePayload)
            .eq('id', id_concluida)
            .select('veiculo_id, ordem_rota')
            .single();

        if (err1) throw err1;

        res.json({ success: true, message: "Entrega concluída. Próximo cliente será avisado em 5 min." });

        // 2. Aguardar 5 minutos (Temporizador solicitado)
        console.log(`⏳ Aguardando 5 minutos para avisar o próximo cliente após entrega ${id_concluida}...`);

        setTimeout(async () => {
            try {
                // 3. Buscar a PRÓXIMA entrega da mesma rota/veículo
                const { data: proximaEntrega, error: err2 } = await supabase
                    .from('entregas')
                    .select('*')
                    .eq('veiculo_id', entregaAtual.veiculo_id)
                    .eq('status', 'Em rota') // Ou o status que você usa para pendentes na carga
                    .gt('ordem_rota', entregaAtual.ordem_rota)
                    .order('ordem_rota', { ascending: true })
                    .limit(1)
                    .single();

                if (err2 || !proximaEntrega) {
                    console.log("🏁 Fim da rota ou nenhum próximo cliente encontrado.");
                    return;
                }

                // 4. Atualizar status da próxima para "Próxima parada"
                await supabase
                    .from('entregas')
                    .update({ status: 'Próxima parada' })
                    .eq('id', proximaEntrega.id);

                // 5. Disparar o aviso via Rota 4 (Internamente)
                const baseUrl = process.env.PUBLIC_URL || "https://moveispedroii.com.br";
                const linkRastreio = `${baseUrl}/rastreio/${proximaEntrega.id}`;
                const tel = proximaEntrega.cliente_telefone.replace(/\D/g, '');
                const chatId = (tel.length <= 11 ? '55' : '') + tel + '@c.us';

                const msg = `*Móveis Pedro II Informa:* 📍\n\nOlá *${proximaEntrega.cliente_nome}*! O motorista finalizou a entrega anterior e **você é a próxima parada!**\n\nPrepare-se para receber seus móveis em breve.\n\n👇 *Acompanhe a localização do caminhão ao vivo:*\n${linkRastreio}`;

                await enviarMensagemSegura(chatId, msg);
                console.log(`✅ Próximo cliente avisado automaticamente: ${proximaEntrega.cliente_nome}`);

            } catch (autoErr) {
                console.error("❌ Erro no automatismo de próxima parada:", autoErr.message);
            }
        }, 300000); // 5 minutos

    } catch (e) {
        console.error("Erro ao concluir entrega:", e.message);
        res.status(500).json({ error: e.message });
    }
});

// 🏗️ CATCH-ALL MIDDLEWARE (React Router)
// Return index.html for any unknown route so React handles routing
// MOVED TO END: Must be after all API routes to avoid intercepting them
app.use((req, res, next) => {
    // Skip API routes - let them fall through to 404 handler
    if (req.path.startsWith('/whatsapp') || req.path.startsWith('/nfe-xml') || req.path.startsWith('/buscar') || req.path.startsWith('/enviar') || req.path.startsWith('/api')) {
        return next();
    }
    const indexPath = path.join(distPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        next(); // Fallback to error handler or 404
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Link local: http://localhost:${PORT}`);

    // 🤖 Inicializar WhatsApp via manager (retry + watchdog automáticos)
    await whatsapp.initialize();
});
