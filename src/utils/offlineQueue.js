import localforage from 'localforage';

export const offlineQueueDB = localforage.createInstance({
    name: 'moveis_pedro_ii',
    storeName: 'whatsapp_offline_queue'
});

/**
 * Salva uma requisição do WhatsApp na fila offline
 * @param {string} actionName - Nome da função (ex: 'sendMessage', 'sendConfirmations')
 * @param {Array} payloadArgs - Array com os argumentos passados para a função
 */
export const saveToOfflineQueue = async (actionName, payloadArgs) => {
    try {
        const timestamp = Date.now();
        const id = `req_${timestamp}_${Math.random().toString(36).substring(7)}`;

        await offlineQueueDB.setItem(id, {
            id,
            action: actionName,
            payload: payloadArgs,
            timestamp,
            status: 'pending'
        });

        return true;
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
        const keys = await offlineQueueDB.keys();
        const items = await Promise.all(keys.map(key => offlineQueueDB.getItem(key)));
        // Ordena do mais antigo para o mais novo
        return items.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
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
        await offlineQueueDB.removeItem(id);
        return true;
    } catch (error) {
        console.error(`Erro ao remover o item ${id} da fila:`, error);
        return false;
    }
};
