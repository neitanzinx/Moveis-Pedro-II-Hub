// @ts-nocheck - This is a Deno/Supabase Edge Function, not Node.js
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stone-webhook-event-id',
}

/**
 * Webhook para receber notificações de pagamento PIX da Stone
 * 
 * A Stone envia eventos quando:
 * - PIX é pago (status: CONCLUIDA)
 * - PIX expira (status: EXPIRADA)
 * - PIX é cancelado (status: REMOVIDA_PELO_USUARIO_RECEBEDOR)
 */
serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Apenas aceitar POST
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Obter ID do evento para idempotência
        const eventId = req.headers.get('x-stone-webhook-event-id');

        // Parse do body
        const body = await req.json();

        console.log('Stone Webhook received:', JSON.stringify(body, null, 2));
        console.log('Event ID:', eventId);

        // Stone envia diferentes formatos dependendo do tipo de evento
        // Vamos tratar o evento de pagamento PIX recebido
        const {
            event_type,
            data,
            target_type,
            target_id
        } = body;

        // Verificar se é um evento de PIX payment
        if (!data) {
            console.log('No data in webhook, skipping');
            return new Response(
                JSON.stringify({ received: true, processed: false }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Extrair informações do pagamento
        const txId = data.transaction_id || data.txid || target_id;
        const status = data.status || 'CONCLUIDA';
        const valorPago = data.amount ? data.amount / 100 : null; // Stone usa centavos
        const e2eId = data.e2e_id || data.end_to_end_id || null;
        const pagadorNome = data.payer?.name || data.pagador?.nome || null;
        const pagadorDocumento = data.payer?.document || data.pagador?.cpf || null;

        if (!txId) {
            console.log('No txId found in webhook');
            return new Response(
                JSON.stringify({ received: true, processed: false, reason: 'no_txid' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Buscar cobrança no banco
        const { data: cobranca, error: findError } = await supabaseClient
            .from('cobrancas_pix')
            .select('*')
            .eq('stone_txid', txId)
            .single();

        if (findError || !cobranca) {
            console.log('Cobrança não encontrada para txId:', txId);
            return new Response(
                JSON.stringify({ received: true, processed: false, reason: 'cobranca_not_found' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Verificar idempotência - se já processou este evento, ignorar
        if (cobranca.webhook_recebido && eventId) {
            const webhookIds = cobranca.webhook_data?.event_ids || [];
            if (webhookIds.includes(eventId)) {
                console.log('Evento já processado:', eventId);
                return new Response(
                    JSON.stringify({ received: true, processed: false, reason: 'already_processed' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Determinar novo status
        let novoStatus = 'CONCLUIDA';
        if (status === 'CONFIRMED' || status === 'SETTLED' || status === 'CONCLUIDA' || event_type?.includes('settled')) {
            novoStatus = 'CONCLUIDA';
        } else if (status === 'EXPIRED' || status === 'EXPIRADA') {
            novoStatus = 'EXPIRADA';
        } else if (status === 'CANCELLED' || status === 'REMOVIDA') {
            novoStatus = 'REMOVIDA_PELO_USUARIO_RECEBEDOR';
        }

        // Atualizar cobrança
        const webhookData = {
            event_ids: [...(cobranca.webhook_data?.event_ids || []), eventId].filter(Boolean),
            last_event: body,
            last_update: new Date().toISOString()
        };

        const { error: updateError } = await supabaseClient
            .from('cobrancas_pix')
            .update({
                status: novoStatus,
                data_pagamento: novoStatus === 'CONCLUIDA' ? new Date().toISOString() : null,
                valor_pago: valorPago || cobranca.valor,
                stone_e2e_id: e2eId,
                pagador_nome: pagadorNome || cobranca.pagador_nome,
                pagador_documento: pagadorDocumento || cobranca.pagador_documento,
                webhook_recebido: true,
                webhook_data: webhookData
            })
            .eq('id', cobranca.id);

        if (updateError) {
            console.error('Error updating cobranca:', updateError);
        }

        // Se pagamento confirmado, atualizar venda e/ou entrega
        if (novoStatus === 'CONCLUIDA') {
            // Atualizar venda se existir
            if (cobranca.venda_id) {
                await supabaseClient
                    .from('vendas')
                    .update({
                        status_pagamento: 'PAGO',
                        data_pagamento: new Date().toISOString()
                    })
                    .eq('id', cobranca.venda_id);

                console.log('Venda atualizada para PAGO:', cobranca.venda_id);
            }

            // Atualizar entrega se existir
            if (cobranca.entrega_id) {
                await supabaseClient
                    .from('entregas')
                    .update({
                        pagamento_confirmado: true,
                        data_pagamento: new Date().toISOString()
                    })
                    .eq('id', cobranca.entrega_id);

                console.log('Entrega atualizada com pagamento confirmado:', cobranca.entrega_id);
            }

            // Criar lançamento financeiro automático
            if (cobranca.venda_id || cobranca.numero_pedido) {
                const lancamentoData = {
                    descricao: `PIX Recebido - Pedido #${cobranca.numero_pedido || 'N/A'}`,
                    valor: valorPago || cobranca.valor,
                    tipo: 'receita',
                    categoria: 'Vendas',
                    data_lancamento: new Date().toISOString().split('T')[0],
                    status: 'Confirmado',
                    forma_pagamento: 'PIX',
                    venda_id: cobranca.venda_id,
                    numero_pedido: cobranca.numero_pedido,
                    observacao: `Pagamento PIX confirmado via Stone. E2E: ${e2eId || 'N/A'}`
                };

                await supabaseClient
                    .from('lancamentos_financeiros')
                    .insert(lancamentoData);

                console.log('Lançamento financeiro criado para PIX');
            }

            // Enviar notificação via WhatsApp Bot (opcional)
            if (cobranca.pagador_nome || cobranca.numero_pedido) {
                try {
                    await fetch('http://localhost:3001/pix-confirmado', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            numero_pedido: cobranca.numero_pedido,
                            valor: valorPago || cobranca.valor,
                            nome: cobranca.pagador_nome
                        })
                    });
                } catch (e) {
                    // WhatsApp bot pode não estar disponível, ignorar erro
                    console.log('WhatsApp notification skipped:', e.message);
                }
            }
        }

        return new Response(
            JSON.stringify({
                received: true,
                processed: true,
                txid: txId,
                status: novoStatus
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Webhook error:', error);
        // Retornar 200 para a Stone não reenviar indefinidamente
        return new Response(
            JSON.stringify({ received: true, error: error.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
