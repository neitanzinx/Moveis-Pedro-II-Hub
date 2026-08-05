// Supabase Edge Function: consultar-nfe
// Deploy: supabase functions deploy consultar-nfe --no-verify-jwt
// API: ACBR API (multi-tenant)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAcbrToken } from '../_shared/acbrAuth.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { nfe_ref, ambiente = 'homologacao', organization_id } = await req.json()

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

        // ─── Resolve organization_id ─────────────────────────────────────────
        let orgId = organization_id;

        if (!orgId) {
            // Fallback: get org from the NF-e record → venda
            const { data: nfeRecord } = await supabase
                .from('notas_fiscais_emitidas')
                .select('venda_id')
                .eq('acbr_id', nfe_ref)
                .single();

            if (nfeRecord?.venda_id) {
                const { data: venda } = await supabase
                    .from('vendas')
                    .select('organization_id')
                    .eq('id', nfeRecord.venda_id)
                    .single();

                orgId = venda?.organization_id;
            }
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

        // ─── ACBR API: Consultar ─────────────────────────────────────────────
        const nfeResponse = await fetch(`${auth.baseUrl}/nfe/${nfe_ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
            },
        });

        if (!nfeResponse.ok) {
            if (nfeResponse.status === 404) {
                throw new Error('NF-e não encontrada na ACBR API para este ID.');
            }
            const errBody = await nfeResponse.text();
            throw new Error(`Erro ao consultar NF-e: ${nfeResponse.status} - ${errBody}`);
        }

        const nfeData = await nfeResponse.json();
        const motivoStatus = nfeData.motivo_status || nfeData.mensagem_sefaz || nfeData.autorizacao?.motivo_status || null;
        const codigoStatus = nfeData.codigo_status || nfeData.autorizacao?.codigo_status || null;

        // ─── Update local records ────────────────────────────────────────────
        let vendaId: string | null = null;
        if (nfeData.status) {
            const updateData: any = {
                status: nfeData.status,
                updated_at: new Date().toISOString(),
            };

            if (nfeData.chave) updateData.chave_acesso = nfeData.chave;
            if (nfeData.numero_nf || nfeData.numero) updateData.numero_nota = String(nfeData.numero_nf || nfeData.numero);
            if (nfeData.serie) updateData.serie = String(nfeData.serie);
            if (nfeData.numero_protocolo || nfeData.protocolo) updateData.protocolo_autorizacao = nfeData.numero_protocolo || nfeData.protocolo;
            if (codigoStatus) updateData.codigo_status = String(codigoStatus);
            if (motivoStatus) {
                updateData.motivo_status = motivoStatus;
            }

            const { data: nfeRow } = await supabase
                .from('notas_fiscais_emitidas')
                .update(updateData)
                .eq('acbr_id', nfe_ref)
                .select('venda_id')
                .single();

            vendaId = nfeRow?.venda_id ?? null;

            // Also update vendas table
            await supabase
                .from('vendas')
                .update({
                    nfe_status: nfeData.status,
                    nfe_chave: nfeData.chave || null,
                    nfe_numero: (nfeData.numero_nf || nfeData.numero) ? String(nfeData.numero_nf || nfeData.numero) : null,
                    nfe_mensagem: motivoStatus || nfeData.status,
                })
                .eq('nfe_ref', nfe_ref);

            // ─── Audit event for terminal status transitions ─────────────────
            const terminalStatuses = ['autorizado', 'autorizada', 'cancelado', 'rejeitado', 'denegado', 'erro_autorizacao'];
            if (vendaId && terminalStatuses.includes(nfeData.status)) {
                await supabase.from('nfe_eventos').insert({
                    organization_id: orgId,
                    venda_id: vendaId,
                    nfe_ref,
                    tipo_evento: `consulta_${nfeData.status}`,
                    status_novo: nfeData.status,
                    codigo_sefaz: codigoStatus ? parseInt(String(codigoStatus)) : null,
                    motivo_sefaz: motivoStatus,
                    protocolo: nfeData.numero_protocolo || nfeData.protocolo || null,
                    dados_resposta: { codigo_status: codigoStatus },
                });
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                status: nfeData.status,
                chave: nfeData.chave,
                numero: nfeData.numero_nf || nfeData.numero,
                serie: nfeData.serie,
                protocolo: nfeData.numero_protocolo || nfeData.protocolo,
                codigo_status: codigoStatus,
                motivo_status: motivoStatus,
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
