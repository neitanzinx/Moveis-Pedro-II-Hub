import localforage from 'localforage';

// ── Storage key ──────────────────────────────────────────────────────────────
const LS_KEY = 'mpii_whatsapp_offline_queue';

// Legacy localforage instance — usado apenas para migração única
const legacyDB = localforage.createInstance({
    name: 'moveis_pedro_ii',
    storeName: 'whatsapp_offline_queue'
});

// ── Helpers internos ─────────────────────────────────────────────────────────
const readQueue = () => {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const writeQueue = (queue) => {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(queue));
        return true;
    } catch (e) {
        console.error('Erro ao gravar fila offline no localStorage:', e);
        return false;
    }
};

const notifyOfflineQueueUpdated = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
};

// ── Migração única do localforage → localStorage ─────────────────────────────
let migrated = false;
const migrateFromLocalforage = async () => {
    if (migrated) return;
    migrated = true;
    try {
        const keys = await legacyDB.keys();
        if (keys.length === 0) return;

        const current = readQueue();
        const existingIds = new Set(current.map(i => i.id));

        for (const key of keys) {
            const item = await legacyDB.getItem(key);
            if (item && !existingIds.has(item.id)) {
                current.push(item);
            }
            await legacyDB.removeItem(key);
        }

        writeQueue(current.sort((a, b) => a.timestamp - b.timestamp));
        notifyOfflineQueueUpdated();
        console.log(`Migrados ${keys.length} itens do localforage para localStorage.`);
    } catch (e) {
        console.warn('Falha na migração localforage → localStorage:', e);
    }
};

// Dispara migração imediatamente ao importar o módulo
migrateFromLocalforage();

// ── API pública (mantém mesma assinatura async) ──────────────────────────────

/**
 * Salva uma requisição do WhatsApp na fila offline
 * @param {string} actionName - Nome da função (ex: 'sendMessage', 'sendConfirmations')
 * @param {Array} payloadArgs - Array com os argumentos passados para a função
 */
export const saveToOfflineQueue = async (actionName, payloadArgs) => {
    try {
        const timestamp = Date.now();
        const id = `req_${timestamp}_${Math.random().toString(36).substring(7)}`;
        const item = { id, action: actionName, payload: payloadArgs, timestamp, status: 'pending' };

        const queue = readQueue();
        queue.push(item);
        const ok = writeQueue(queue);

        if (ok) {
            notifyOfflineQueueUpdated();
        }

        return ok;
    } catch (error) {
        console.error('Erro ao salvar requisição na fila offline:', error);
        return false;
    }
};

/**
 * Pega todos os itens da fila offline
 * @returns {Promise<Array>}
 */
export const getOfflineQueue = async () => {
    try {
        const queue = readQueue();
        return queue.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
        console.error('Erro ao buscar fila offline:', error);
        return [];
    }
};

/**
 * Remove um item processado da fila
 * @param {string} id
 */
export const removeOfflineQueueItem = async (id) => {
    try {
        const queue = readQueue();
        const filtered = queue.filter(item => item.id !== id);
        const ok = writeQueue(filtered);
        if (ok) {
            notifyOfflineQueueUpdated();
        }
        return ok;
    } catch (error) {
        console.error(`Erro ao remover o item ${id} da fila:`, error);
        return false;
    }
};

// Re-export for backward compat (some files import this)
export const offlineQueueDB = legacyDB;
