// Supabase Edge Function: consultar-nfe
// Deploy: supabase functions deploy consultar-nfe --no-verify-jwt
// API: Nuvem Fiscal (multi-tenant)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getNuvemFiscalToken } from '../_shared/nuvemFiscalAuth.ts'

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
                JSON.stringify({ error: 'nfe_ref é obrigatório (ID da NF-e na Nuvem Fiscal)' }),
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
                .eq('nuvem_fiscal_id', nfe_ref)
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

        // ─── Get Nuvem Fiscal Token ──────────────────────────────────────────
        let auth;
        try {
            auth = await getNuvemFiscalToken(supabase, orgId, ambiente);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: (e as Error).message, configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── Nuvem Fiscal API: Consultar ─────────────────────────────────────
        const nfeResponse = await fetch(`${auth.baseUrl}/nfe/${nfe_ref}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
            },
        });

        if (!nfeResponse.ok) {
            if (nfeResponse.status === 404) {
                throw new Error('NF-e não encontrada na Nuvem Fiscal para este ID.');
            }
            const errBody = await nfeResponse.text();
            throw new Error(`Erro ao consultar NF-e: ${nfeResponse.status} - ${errBody}`);
        }

        const nfeData = await nfeResponse.json();

        // ─── Update local records ────────────────────────────────────────────
        if (nfeData.status) {
            const updateData: any = {
                status: nfeData.status,
                updated_at: new Date().toISOString(),
            };

            if (nfeData.chave) updateData.chave_acesso = nfeData.chave;
            if (nfeData.numero) updateData.numero_nota = String(nfeData.numero);
            if (nfeData.serie) updateData.serie = String(nfeData.serie);
            if (nfeData.protocolo) updateData.protocolo_autorizacao = nfeData.protocolo;
            if (nfeData.codigo_status) updateData.codigo_status = String(nfeData.codigo_status);
            if (nfeData.motivo_status || nfeData.mensagem_sefaz) {
                updateData.motivo_status = nfeData.motivo_status || nfeData.mensagem_sefaz;
            }

            await supabase
                .from('notas_fiscais_emitidas')
                .update(updateData)
                .eq('nuvem_fiscal_id', nfe_ref);

            // Also update vendas table
            await supabase
                .from('vendas')
                .update({
                    nfe_status: nfeData.status,
                    nfe_chave: nfeData.chave || null,
                    nfe_numero: nfeData.numero ? String(nfeData.numero) : null,
                    nfe_mensagem: nfeData.motivo_status || nfeData.mensagem_sefaz || nfeData.status,
                })
                .eq('nfe_ref', nfe_ref);
        }

        // ─── Build DANFE and XML URLs ────────────────────────────────────────
        const danfeUrl = `${auth.baseUrl}/nfe/${nfe_ref}/pdf`;
        const xmlUrl = `${auth.baseUrl}/nfe/${nfe_ref}/xml`;

        return new Response(
            JSON.stringify({
                success: true,
                status: nfeData.status,
                chave: nfeData.chave,
                numero: nfeData.numero,
                serie: nfeData.serie,
                protocolo: nfeData.protocolo,
                codigo_status: nfeData.codigo_status,
                motivo_status: nfeData.motivo_status || nfeData.mensagem_sefaz,
                caminho_danfe: danfeUrl,
                caminho_xml: xmlUrl,
                // Pass the token so frontend can download with auth
                _auth_token: auth.accessToken,
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
