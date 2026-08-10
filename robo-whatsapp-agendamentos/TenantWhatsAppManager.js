/**
 * =============================================================================
 * 🤖 TENANT WHATSAPP MANAGER — Gerenciador Multi-Sessão / Multi-Tenant
 * =============================================================================
 * Permite que cada organização (empresa) possua sua própria instância isolada
 * do WhatsApp Web (Client), com sessão, QR Code, status e envio independentes.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

class TenantWhatsAppManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        /** @type {Map<string, { client: Client, status: string, qr: string|null, info: object|null, reconnectAttempts: number, isInitializing: boolean, isReconnecting: boolean, disconnectedSince: number|null }>} */
        this.sessions = new Map();
        this.baseAuthPath = path.join(process.cwd(), '.wwebjs_auth');

        // Cria pasta base se não existir
        try {
            if (!fs.existsSync(this.baseAuthPath)) {
                fs.mkdirSync(this.baseAuthPath, { recursive: true });
            }
        } catch (e) {
            console.error('Erro ao criar diretório base de autenticação:', e.message);
        }
    }

    /**
     * Retorna o clientId para o LocalAuth do whatsapp-web.js
     */
    getClientId(orgId) {
        // Compatibilidade retroativa para organização padrão caso exista sessão legada
        if (orgId === DEFAULT_ORG_ID) {
            const legacyPath = path.join(this.baseAuthPath, 'session-client-v5');
            if (fs.existsSync(legacyPath)) {
                return 'client-v5';
            }
        }
        return `tenant-${orgId}`;
    }

    /**
     * Cria uma nova instância de Client para uma organização
     */
    createClientInstance(orgId) {
        const clientId = this.getClientId(orgId);
        console.log(`🔧 [TenantManager] Criando instância Client para Org: ${orgId} | ClientId: ${clientId}`);

        return new Client({
            authStrategy: new LocalAuth({
                clientId: clientId,
                dataPath: this.baseAuthPath
            }),
            authTimeoutMs: 60000,
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        });
    }

    /**
     * Registra os ouvintes de evento no client da organização
     */
    attachEvents(orgId, session) {
        const c = session.client;

        c.on('qr', (qr) => {
            session.qr = qr;
            session.status = 'waiting_qr';
            console.log(`📱 [Org: ${orgId}] QR Code gerado — escaneie pela interface.`);
            try {
                qrcode.generate(qr, { small: true });
            } catch (_) {}
        });

        c.on('authenticated', async () => {
            console.log(`🔐 [Org: ${orgId}] Autenticação bem-sucedida!`);
            session.status = 'connected';
            session.qr = null;
            session.reconnectAttempts = 0;
            session.disconnectedSince = null;
            session.isInitializing = false;
            session.isReconnecting = false;
            try {
                const info = await c.info;
                if (info) {
                    session.info = {
                        wid: info.wid?.user || 'N/A',
                        pushname: info.pushname || 'WhatsApp Bot',
                        platform: info.platform || 'unknown'
                    };
                }
            } catch (e) {
                console.log(`⚠️ [Org: ${orgId}] Info indisponível, mas autenticado.`);
            }
        });

        c.on('ready', async () => {
            session.status = 'connected';
            session.qr = null;
            session.reconnectAttempts = 0;
            session.disconnectedSince = null;
            session.isInitializing = false;
            session.isReconnecting = false;
            try {
                const info = await c.info;
                session.info = {
                    wid: info?.wid?.user || 'N/A',
                    pushname: info?.pushname || 'WhatsApp Bot',
                    platform: info?.platform || 'unknown'
                };
                console.log(`✅ [Org: ${orgId}] Robô Online! Conectado como: ${session.info.pushname} (+${session.info.wid})`);
            } catch (e) {
                session.info = null;
                console.log(`✅ [Org: ${orgId}] Robô Online!`);
            }
        });

        c.on('disconnected', async (reason) => {
            console.log(`❌ [Org: ${orgId}] WhatsApp desconectado: ${reason}`);
            session.status = 'disconnected';
            session.qr = null;
            session.info = null;
            session.disconnectedSince = session.disconnectedSince || Date.now();
            session.isInitializing = false;
            session.isReconnecting = false;
        });

        c.on('auth_failure', async (msg) => {
            console.log(`⚠️ [Org: ${orgId}] Falha na autenticação: ${msg}`);
            session.status = 'disconnected';
            session.qr = null;
            session.info = null;
            session.isInitializing = false;
            session.isReconnecting = false;
        });
    }

    /**
     * Obtém ou inicializa a sessão de uma organização
     */
    async getOrCreateSession(orgId = DEFAULT_ORG_ID) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        let session = this.sessions.get(orgId);
        if (session) {
            return session;
        }

        // Criar nova estrutura de sessão
        const client = this.createClientInstance(orgId);
        session = {
            client,
            status: 'initializing',
            qr: null,
            info: null,
            reconnectAttempts: 0,
            isInitializing: true,
            isReconnecting: false,
            disconnectedSince: null
        };

        this.attachEvents(orgId, session);
        this.sessions.set(orgId, session);

        try {
            console.log(`🚀 [TenantManager] Inicializando sessão WhatsApp para Org: ${orgId}...`);
            await client.initialize();
        } catch (err) {
            console.error(`💥 [TenantManager] Falha ao inicializar WhatsApp para Org ${orgId}:`, err.message);
            session.status = 'disconnected';
            session.isInitializing = false;
        }

        return session;
    }

    /**
     * Obtém o status da sessão de uma organização
     */
    async getStatus(orgId = DEFAULT_ORG_ID) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        let session = this.sessions.get(orgId);
        if (!session) {
            // Inicializar on-demand se ainda não existir
            session = await this.getOrCreateSession(orgId);
        }

        return {
            status: session.status || 'disconnected',
            qr: session.qr || null,
            info: session.info || null,
            organization_id: orgId
        };
    }

    /**
     * Força a reconexão / novo QR Code para a organização
     */
    async reconnect(orgId = DEFAULT_ORG_ID) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        console.log(`🔄 [TenantManager] Forçando reconexão para Org: ${orgId}...`);
        const session = this.sessions.get(orgId);

        if (session && session.client) {
            try {
                session.isReconnecting = true;
                await session.client.destroy().catch(() => {});
            } catch (e) {
                console.warn(`Aviso ao destruir client antigo da Org ${orgId}:`, e.message);
            }
            this.sessions.delete(orgId);
        }

        // Criar e inicializar nova sessão
        const newSession = await this.getOrCreateSession(orgId);
        return {
            success: true,
            message: 'Reconexão iniciada para a organização.',
            status: newSession.status
        };
    }

    /**
     * Desconecta a sessão da organização e limpa dados de login
     */
    async disconnect(orgId = DEFAULT_ORG_ID) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        console.log(`🔌 [TenantManager] Desconectando sessão da Org: ${orgId}...`);
        const session = this.sessions.get(orgId);

        if (session && session.client) {
            try {
                await session.client.logout().catch(() => {});
                await session.client.destroy().catch(() => {});
            } catch (e) {
                console.warn(`Aviso ao deslogar da Org ${orgId}:`, e.message);
            }
            this.sessions.delete(orgId);
        }

        // Limpar pasta de sessão da organização se existir
        const clientId = this.getClientId(orgId);
        const sessionFolder = path.join(this.baseAuthPath, `session-${clientId}`);
        try {
            if (fs.existsSync(sessionFolder)) {
                fs.rmSync(sessionFolder, { recursive: true, force: true });
                console.log(`🧹 [TenantManager] Pasta de sessão excluída: ${sessionFolder}`);
            }
        } catch (e) {
            console.warn(`Erro ao excluir pasta da sessão ${clientId}:`, e.message);
        }

        return {
            success: true,
            message: 'Sessão desconectada com sucesso.'
        };
    }

    /**
     * Envia mensagem de texto pela sessão da organização
     */
    async sendMessage(orgId = DEFAULT_ORG_ID, chatId, content, options = {}) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        const session = this.sessions.get(orgId);
        if (!session || session.status !== 'connected' || !session.client) {
            return {
                success: false,
                connected: false,
                error: `WhatsApp da organização ${orgId} não está conectado.`
            };
        }

        try {
            console.log(`📤 [Org: ${orgId}] Enviando mensagem para ${chatId}...`);
            const result = await session.client.sendMessage(chatId, content, options);
            console.log(`✅ [Org: ${orgId}] Mensagem enviada com sucesso para ${chatId}`);
            return { success: true, result };
        } catch (error) {
            console.error(`❌ [Org: ${orgId}] Erro ao enviar mensagem para ${chatId}:`, error.message);
            // Tratamento especial para markedUnread / getChat
            if (error.message && (error.message.includes('markedUnread') || error.message.includes("reading 'getChat'"))) {
                return { success: true, warning: error.message };
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Envia mensagem com mídia pela sessão da organização
     */
    async sendMedia(orgId = DEFAULT_ORG_ID, chatId, media, options = {}) {
        if (!orgId) orgId = DEFAULT_ORG_ID;

        const session = this.sessions.get(orgId);
        if (!session || session.status !== 'connected' || !session.client) {
            return {
                success: false,
                connected: false,
                error: `WhatsApp da organização ${orgId} não está conectado.`
            };
        }

        try {
            const result = await session.client.sendMessage(chatId, media, options);
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Inicializa sessões para todas as organizações que possuem módulo WhatsApp ativo
     */
    async initActiveTenants() {
        try {
            console.log('🔍 [TenantManager] Buscando organizações com módulo WhatsApp ativo...');
            
            // Sempre inicializa a organização padrão
            await this.getOrCreateSession(DEFAULT_ORG_ID);

            if (!this.supabase) return;

            const { data: orgs, error } = await this.supabase
                .from('organization_settings')
                .select('organization_id, modulos_ativos');

            if (error || !orgs) {
                console.warn('⚠️ [TenantManager] Falha ao listar organizações ativas:', error?.message);
                return;
            }

            for (const org of orgs) {
                const orgId = org.organization_id;
                if (!orgId || orgId === DEFAULT_ORG_ID) continue;

                const whatsappAtivo = org.modulos_ativos?.whatsapp === true;
                if (whatsappAtivo) {
                    console.log(`🏢 [TenantManager] Iniciando sessão para organização: ${orgId}`);
                    // Inicialização em background para não travar boot
                    this.getOrCreateSession(orgId).catch(err => {
                        console.error(`Erro ao iniciar sessão da org ${orgId}:`, err.message);
                    });
                }
            }
        } catch (e) {
            console.error('💥 [TenantManager] Erro no carregamento inicial de tenants:', e.message);
        }
    }
}

module.exports = { TenantWhatsAppManager, DEFAULT_ORG_ID };
