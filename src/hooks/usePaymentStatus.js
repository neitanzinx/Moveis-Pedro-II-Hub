import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hook para monitorar status de um link de pagamento
 * Usa Supabase Realtime para receber notificações instantâneas quando o pagamento é confirmado
 * 
 * @param {string} paymentLinkId - ID do payment_link a monitorar
 * @param {Object} options - Opções do hook
 * @param {boolean} options.showToast - Se deve mostrar toast ao confirmar (default: true)
 * @param {function} options.onPaid - Callback quando pagamento for confirmado
 * @param {function} options.onExpired - Callback quando link expirar
 * @param {function} options.onStatusChange - Callback para qualquer mudança de status
 */
export function usePaymentStatus(paymentLinkId, options = {}) {
    const {
        showToast = true,
        onPaid,
        onExpired,
        onStatusChange
    } = options;

    const [status, setStatus] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [paymentLink, setPaymentLink] = useState(null);

    // Buscar status inicial
    const fetchStatus = useCallback(async () => {
        if (!paymentLinkId) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('payment_links')
                .select('*')
                .eq('id', paymentLinkId)
                .single();

            if (error) throw error;

            setPaymentLink(data);
            setStatus(data.status);
        } catch (error) {
            console.error('Erro ao buscar status do pagamento:', error);
        } finally {
            setLoading(false);
        }
    }, [paymentLinkId]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Configurar listener Realtime
    useEffect(() => {
        if (!paymentLinkId) return;

        const channel = supabase
            .channel(`payment_link_${paymentLinkId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'payment_links',
                    filter: `id=eq.${paymentLinkId}`
                },
                (payload) => {
                    const newData = payload.new;
                    const oldStatus = status;
                    const newStatus = newData.status;

                    setPaymentLink(newData);
                    setStatus(newStatus);

                    // Callback genérico
                    onStatusChange?.(newStatus, oldStatus, newData);

                    // Status específicos
                    if (newStatus === 'paid' && oldStatus !== 'paid') {
                        if (showToast) {
                            toast.success('💰 Pagamento confirmado!', {
                                description: `Valor: R$ ${(newData.amount / 100).toFixed(2)}`,
                                duration: 5000
                            });
                        }
                        onPaid?.(newData);
                    }

                    if (newStatus === 'expired' && oldStatus !== 'expired') {
                        if (showToast) {
                            toast.warning('Link de pagamento expirado', {
                                description: 'O link de pagamento expirou sem ser pago'
                            });
                        }
                        onExpired?.(newData);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [paymentLinkId, status, showToast, onPaid, onExpired, onStatusChange]);

    return {
        status,
        loading,
        paymentLink,
        isPaid: status === 'paid',
        isPending: status === 'pending',
        isExpired: status === 'expired',
        refetch: fetchStatus
    };
}

/**
 * Hook simplificado para monitorar qualquer pagamento pendente da venda
 * Monitora a tabela payment_links filtrada por venda_id
 */
export function useVendaPaymentStatus(vendaId, options = {}) {
    const [paymentLinkId, setPaymentLinkId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Buscar payment_link da venda
    useEffect(() => {
        if (!vendaId) {
            setLoading(false);
            return;
        }

        const fetchPaymentLink = async () => {
            try {
                const { data } = await supabase
                    .from('payment_links')
                    .select('id')
                    .eq('venda_id', vendaId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (data) {
                    setPaymentLinkId(data.id);
                }
            } catch (error) {
                // Venda pode não ter link de pagamento
            } finally {
                setLoading(false);
            }
        };

        fetchPaymentLink();
    }, [vendaId]);

    const paymentStatus = usePaymentStatus(paymentLinkId, options);

    return {
        ...paymentStatus,
        loading: loading || paymentStatus.loading,
        hasPaymentLink: !!paymentLinkId
    };
}

export default usePaymentStatus;
