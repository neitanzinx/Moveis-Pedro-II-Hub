// Supabase Edge Function: sincronizar-nfe
// Deploy: supabase functions deploy sincronizar-nfe --no-verify-jwt
// API: ACBR API (consulta/reprocessamento)
//
// Purpose: Force re-sync of a NF-e against SEFAZ.
// Use when a note is stuck in 'pendente' or 'processando' due to network failure
// or when the local status diverges from SEFAZ reality.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Statuses that warrant a sync/check call
const SYNCABLE_STATUSES = ['pendente', 'processando', 'em_processamento'];

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            nfe_ref,
            ambiente = 'homologacao',
            organization_id,
            user_id,
        } = await req.json()

        if (!nfe_ref) {
            return new Response(
                JSON.stringify({ error: 'nfe_ref é obrigatório (ID da NF-e na ACBR API)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ─── Resolve organization_id + fetch current NF-e record ─────────────
        let orgId = organization_id;
        let vendaId: string | null = null;
        let currentStatus: string | null = null;

        const { data: nfeRecord } = await supabase
            .from('notas_fiscais_emitidas')
            .select('venda_id, status')
            .eq('acbr_id', nfe_ref)
            .single();

        if (nfeRecord) {
            vendaId = nfeRecord.venda_id;
            currentStatus = nfeRecord.status;
        }

        if (!orgId && vendaId) {
            const { data: venda } = await supabase
                .from('vendas')
                .select('organization_id')
                .eq('id', vendaId)
                .single();

            orgId = venda?.organization_id;
        }

        if (!orgId) {
            return new Response(
                JSON.stringify({ error: 'Não foi possível identificar a organização. Informe organization_id.', configurado: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── Get ACBR Token ──────────────────────────────────────────────────
        let auth;
        try {
            auth = await getAcbrToken(supabase, orgId, ambiente);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: (e as Error).message, configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── ACBR API: Consultar situação atual ───────────────────────────────
        const sincResponse = await fetch(`${auth.baseUrl}/nfe/${nfe_ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
            },
        });

        if (!sincResponse.ok) {
            const errBody = await sincResponse.text();
            throw new Error(`Erro ao consultar/sincronizar NF-e: ${sincResponse.status} - ${errBody}`);
        }

        const sincData = await sincResponse.json();
        const motivoStatus = sincData.motivo_status || sincData.mensagem_sefaz || sincData.autorizacao?.motivo_status || null;
        const codigoStatus = sincData.codigo_status || sincData.autorizacao?.codigo_status || null;
        const newStatus = sincData.status ?? currentStatus;

        // ─── Update local records ─────────────────────────────────────────────
        const updateData: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        if (sincData.chave) updateData.chave_acesso = sincData.chave;
        if (sincData.numero) updateData.numero_nota = String(sincData.numero);
        if (sincData.serie) updateData.serie = String(sincData.serie);
        if (sincData.protocolo) updateData.protocolo_autorizacao = sincData.protocolo;
        if (codigoStatus) updateData.codigo_status = String(codigoStatus);
        if (motivoStatus) {
            updateData.motivo_status = motivoStatus;
        }

        await supabase
            .from('notas_fiscais_emitidas')
            .update(updateData)
            .eq('acbr_id', nfe_ref);

        await supabase
            .from('vendas')
            .update({
                nfe_status: newStatus,
                nfe_chave: sincData.chave || null,
                nfe_numero: sincData.numero ? String(sincData.numero) : null,
                nfe_mensagem: motivoStatus || newStatus,
            })
            .eq('nfe_ref', nfe_ref);

        // ─── Audit event ──────────────────────────────────────────────────────
        if (vendaId) {
            await supabase.from('nfe_eventos').insert({
                venda_id: vendaId,
                nfe_ref,
                tipo_evento: 'sincronizacao',
                status_anterior: currentStatus ?? null,
                status_novo: newStatus,
                codigo_sefaz: codigoStatus ? parseInt(String(codigoStatus)) : null,
                motivo_sefaz: motivoStatus,
                protocolo: sincData.protocolo ?? null,
                realizado_por_id: user_id ?? null,
                dados_resposta: {
                    status_anterior: currentStatus,
                    status_novo: newStatus,
                },
            });
        }

        const statusChanged = newStatus !== currentStatus;

        return new Response(
            JSON.stringify({
                success: true,
                status: newStatus,
                status_anterior: currentStatus,
                status_changed: statusChanged,
                chave: sincData.chave,
                numero: sincData.numero,
                serie: sincData.serie,
                protocolo: sincData.protocolo,
                codigo_status: codigoStatus,
                motivo_status: motivoStatus,
                mensagem: statusChanged
                    ? `Status atualizado de '${currentStatus}' para '${newStatus}'`
                    : `NF-e mantém status '${newStatus}'`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
