import { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappService';
import { getOfflineQueue, removeOfflineQueueItem } from '@/utils/offlineQueue';
import { toast } from "sonner";

export function useConnectionStatus() {
    const [isSystemOnline, setIsSystemOnline] = useState(navigator.onLine);
    const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(true); // Assume true initially to avoid flashing offline
    const prevWhatsAppConnected = useRef(true);

    // Função de sincronização da fila offline (compartilhada entre triggers)
    const syncOfflineQueue = useCallback(async () => {
        const queue = await getOfflineQueue();
        if (queue.length === 0) return;

        toast.info(`Sincronizando ${queue.length} ação(ões) offline do WhatsApp...`);
        let sucesso = 0;

        for (const item of queue) {
            try {
                if (typeof whatsappService[item.action] === 'function') {
                    await whatsappService[item.action](...item.payload);
                    await removeOfflineQueueItem(item.id);
                    sucesso++;
                } else {
                    // Remove itens inválidos para não ficarem presos na fila indefinidamente
                    console.warn(`Ação inválida encontrada na fila e removida: ${item.action}`);
                    await removeOfflineQueueItem(item.id);
                }
            } catch (error) {
                console.error(`Erro ao sincronizar item offline ${item.id}:`, error);
            }
        }

        if (sucesso > 0) {
            toast.success(`${sucesso} ação(ões) do Zap enviadas com sucesso!`);
        }
    }, []);

    // Monitor System Online/Offline status
    useEffect(() => {
        const handleOnline = () => {
            setIsSystemOnline(true);
            syncOfflineQueue();
        };

        const handleOffline = () => setIsSystemOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncOfflineQueue]);

    // Monitor WhatsApp Bot status
    useEffect(() => {
        const checkWhatsAppStatus = async () => {
            const status = await whatsappService.checkStatus();

            // Se o WhatsApp acabou de reconectar (estava desconectado, agora conectou),
            // sincroniza a fila offline automaticamente
            if (status && !prevWhatsAppConnected.current) {
                console.log('🔄 WhatsApp reconectou! Sincronizando fila offline...');
                syncOfflineQueue();
            }

            prevWhatsAppConnected.current = status;
            setIsWhatsAppConnected(status);
        };

        // Check immediately on mount
        checkWhatsAppStatus();

        // Then check every 30 seconds
        const interval = setInterval(checkWhatsAppStatus, 30000);

        return () => clearInterval(interval);
    }, [syncOfflineQueue]);

    return {
        isSystemOnline,
        isWhatsAppConnected
    };
}
