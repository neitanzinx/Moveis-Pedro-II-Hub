// Supabase Edge Function: baixar-nfe
// Deploy: supabase functions deploy baixar-nfe --no-verify-jwt
// API: ACBR API (multi-tenant — credenciais por organization_id)

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
        const { nfe_id, tipo = 'pdf', ambiente = 'homologacao', organization_id } = await req.json()

        if (!nfe_id) {
            return new Response(
                JSON.stringify({ error: 'nfe_id é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Aceita nfe_id como acbr_id ou chave de acesso (44 dígitos).
        let acbrId = String(nfe_id).trim()
        const maybeChave = acbrId.replace(/\D/g, '')

        // ─── Resolve organization_id ─────────────────────────────────────────
        let orgId = organization_id;
        let vendaId: string | null = null;

        if (maybeChave.length === 44) {
            const { data: nfeRow, error: nfeErr } = await supabase
                .from('notas_fiscais_emitidas')
                .select('acbr_id, venda_id')
                .eq('chave_acesso', maybeChave)
                .maybeSingle()

            if (nfeErr) {
                throw new Error(`Erro ao resolver acbr_id pela chave: ${nfeErr.message}`)
            }

            if (!nfeRow?.acbr_id) {
                throw new Error('NF-e não encontrada no banco para a chave informada')
            }

            acbrId = nfeRow.acbr_id
            vendaId = nfeRow.venda_id
        } else {
            // Buscar pelo acbr_id
            const { data: nfeRow } = await supabase
                .from('notas_fiscais_emitidas')
                .select('venda_id')
                .eq('acbr_id', acbrId)
                .maybeSingle()

            vendaId = nfeRow?.venda_id ?? null
        }

        // Resolver organization_id se não foi passado
        if (!orgId && vendaId) {
            const { data: venda } = await supabase
                .from('vendas')
                .select('organization_id')
                .eq('id', vendaId)
                .single()

            orgId = venda?.organization_id
        }

        if (!orgId) {
            return new Response(
                JSON.stringify({ error: 'Não foi possível identificar a organização. Informe organization_id.', configurado: false }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ─── Get ACBR Token (multi-tenant) ───────────────────────────────────
        let auth;
        try {
            auth = await getAcbrToken(supabase, orgId, ambiente);
        } catch (e) {
            return new Response(
                JSON.stringify({ error: (e as Error).message, configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Baixar arquivo (PDF ou XML)
        const endpoint = tipo === 'pdf' ? 'pdf' : 'xml';
        const acceptHeader = tipo === 'pdf' ? 'application/pdf' : 'application/xml';

        const fileResponse = await fetch(`${auth.baseUrl}/nfe/${acbrId}/${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${auth.accessToken}`,
                'Accept': acceptHeader
            }
        });

        if (!fileResponse.ok) {
            throw new Error(`Arquivo não disponível: ${fileResponse.status}`);
        }

        if (tipo === 'pdf') {
            // Retornar PDF como base64
            const arrayBuffer = await fileResponse.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            const dataUrl = `data:application/pdf;base64,${base64}`;

            return new Response(
                JSON.stringify({
                    success: true,
                    tipo: 'pdf',
                    data: dataUrl
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        } else {
            // Retornar XML como texto
            const xmlContent = await fileResponse.text();

            return new Response(
                JSON.stringify({
                    success: true,
                    tipo: 'xml',
                    data: xmlContent
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

    } catch (error) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ success: false, error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
