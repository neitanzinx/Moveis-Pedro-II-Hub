import localforage from 'localforage';
import { supabase } from '@/api/base44Client';
import { base44 } from '@/api/base44Client';
import { applyDeliveryPayment } from '@/utils/deliveryPayment';

export const deliveryOfflineDB = localforage.createInstance({
    name: 'moveis_pedro_ii',
    storeName: 'delivery_offline_queue'
});

/**
 * Salva uma finalização de entrega na fila offline
 */
export const saveDeliveryToOfflineQueue = async (entregaId, payload) => {
    try {
        await deliveryOfflineDB.setItem(`delivery_${entregaId}`, {
            entregaId,
            payload, // { updateData, fotosOfflineList }
            timestamp: Date.now(),
            status: 'pending'
        });
        return true;
    } catch (error) {
        console.error('Erro ao salvar entrega na fila offline:', error);
        return false;
    }
};

/**
 * Retorna as entregas pendentes
 */
export const getOfflineDeliveries = async () => {
    try {
        const keys = await deliveryOfflineDB.keys();
        const items = await Promise.all(keys.map(key => deliveryOfflineDB.getItem(key)));
        return items.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
        console.error('Erro ao buscar entregas offline:', error);
        return [];
    }
};

/**
 * Remove uma entrega concluída da fila
 */
export const removeOfflineDelivery = async (entregaId) => {
    try {
        await deliveryOfflineDB.removeItem(`delivery_${entregaId}`);
        return true;
    } catch (error) {
        console.error(`Erro ao remover a entrega ${entregaId} da fila:`, error);
        return false;
    }
};

/**
 * Sincroniza todas as entregas pendentes (uploads p/ Storage + banco)
 */
export const syncOfflineDeliveries = async () => {
    const queue = await getOfflineDeliveries();
    let synchronized = 0;

    for (const item of queue) {
        try {
            console.log(`[OfflineSync] Tentando sincronizar entrega ${item.entregaId}...`);
            const payload = item.payload;
            const finalUpdateData = { ...payload.updateData };

            // Se houver fotos que faltaram fazer upload para o Storage
            if (payload.fotosOfflineList && payload.fotosOfflineList.length > 0) {
                const fotosUploadadas = [];
                for (let i = 0; i < payload.fotosOfflineList.length; i++) {
                    const foto = payload.fotosOfflineList[i];

                    // Convert base64 to blob
                    const response = await fetch(foto.dataUrl);
                    const blob = await response.blob();
                    const fileName = `entregas/${item.entregaId}/${Date.now()}_foto_${i + 1}.jpg`;

                    const { error } = await supabase.storage
                        .from('comprovantes')
                        .upload(fileName, blob, {
                            contentType: 'image/jpeg',
                            cacheControl: '3600'
                        });

                    if (error) throw error;

                    const { data: urlData } = supabase.storage
                        .from('comprovantes')
                        .getPublicUrl(fileName);

                    fotosUploadadas.push({
                        url: urlData.publicUrl,
                        tipo: foto.tipo,
                        timestamp: foto.timestamp
                    });
                }

                finalUpdateData.fotos_entrega = fotosUploadadas;
                finalUpdateData.foto_entrega_url = fotosUploadadas[0]?.url || null;
            }

            // Agora atualiza no Supabase via API principal
            await base44.entities.Entrega.update(item.entregaId, finalUpdateData);

            if (payload.financialPayload) {
                await applyDeliveryPayment({
                    ...payload.financialPayload,
                    entrega: {
                        ...payload.financialPayload.entrega,
                        id: item.entregaId,
                    },
                    comprovanteUrl: finalUpdateData.comprovante_pagamento_url || payload.financialPayload.comprovanteUrl || null,
                });
            }

            // Remove da fila offline
            await removeOfflineDelivery(item.entregaId);
            synchronized++;
            console.log(`[OfflineSync] Entrega ${item.entregaId} sincronizada com sucesso!`);
        } catch (error) {
            console.error(`[OfflineSync] Falha ao sincronizar entrega ${item.entregaId}:`, error);
            // Quebra o loop para não tentar o resto se estiver sem internet
            break;
        }
    }

    return synchronized > 0;
};
