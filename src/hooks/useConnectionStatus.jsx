import { useState, useEffect, useRef, useCallback } from 'react';
import { whatsappService } from '@/services/whatsappService';
import { getOfflineQueue, removeOfflineQueueItem } from '@/utils/offlineQueue';
import { toast } from "sonner";

const WHATSAPP_STATUS_CACHE_KEY = 'whatsapp_connection_status';

export function useConnectionStatus(enabled = false) {
    function readCachedStatus() {
        try {
            const cached = localStorage.getItem(WHATSAPP_STATUS_CACHE_KEY);
            if (cached === null) return false;
            return cached === 'true';
        } catch {
            return false;
        }
    }

    function writeCachedStatus(status) {
        try {
            localStorage.setItem(WHATSAPP_STATUS_CACHE_KEY, status ? 'true' : 'false');
        } catch {
            // Ignora falhas de storage para não impactar o layout.
        }
    }

    const prevWhatsAppConnected = useRef(true);
    const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(readCachedStatus());
    const [isSystemOnline, setIsSystemOnline] = useState(navigator.onLine);

    // Função de sincronização da fila offline (compartilhada entre triggers)
    const syncOfflineQueue = useCallback(async () => {
        const whatsappOnline = await whatsappService.checkStatus();
        if (!whatsappOnline) return;

        const queue = await getOfflineQueue();
        if (queue.length === 0) return;

        toast.info(`Sincronizando ${queue.length} ação(ões) offline do WhatsApp...`);
        let sucesso = 0;

        for (const item of queue) {
            try {
                if (typeof whatsappService[item.action] !== 'function') {
                    console.warn(`Ação inválida encontrada na fila e removida: ${item.action}`);
                    await removeOfflineQueueItem(item.id);
                    continue;
                }
                const replayOk = await whatsappService[item.action](...item.payload);
                if (replayOk === true || replayOk?.status === 'sent') {
                    await removeOfflineQueueItem(item.id);
                    sucesso++;
                }
                // replayOk com status 'queued' mantém o item para nova tentativa futura.
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
    }, [enabled, syncOfflineQueue]);

    // Monitor WhatsApp Bot status
    useEffect(() => {
        if (!enabled) {
            return undefined;
        }

        const checkWhatsAppStatus = async () => {
            const status = await whatsappService.checkStatus();

            // Se o WhatsApp reconectou, o modal de confirmação na tela de Configuração
            // permite ao usuário decidir se envia ou descarta as pendências.
            if (status && !prevWhatsAppConnected.current) {
                console.log('🔄 WhatsApp conectado.');
            }

            prevWhatsAppConnected.current = status;
            setIsWhatsAppConnected(status);
            writeCachedStatus(status);
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
