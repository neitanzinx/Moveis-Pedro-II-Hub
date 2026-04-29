// Supabase Edge Function: baixar-nfe
// Deploy: supabase functions deploy baixar-nfe --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { nfe_id, tipo = 'pdf', ambiente = 'homologacao' } = await req.json()

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

        const tokenIntegrador = Deno.env.get('TOKEN_INTEGRADOR')
        if (!tokenIntegrador) {
            return new Response(
                JSON.stringify({ error: 'TOKEN_INTEGRADOR não configurado', configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const API_BASE = ambiente === 'producao'
            ? 'https://prod.acbr.api.br'
            : 'https://hom.acbr.api.br'

        // Aceita nfe_id como acbr_id ou chave de acesso (44 dígitos).
        let acbrId = String(nfe_id).trim()
        const maybeChave = acbrId.replace(/\D/g, '')

        if (maybeChave.length === 44) {
            const { data: nfeRow, error: nfeErr } = await supabase
                .from('notas_fiscais_emitidas')
                .select('acbr_id')
                .eq('chave_acesso', maybeChave)
                .maybeSingle()

            if (nfeErr) {
                throw new Error(`Erro ao resolver acbr_id pela chave: ${nfeErr.message}`)
            }

            if (!nfeRow?.acbr_id) {
                throw new Error('NF-e não encontrada no banco para a chave informada')
            }

            acbrId = nfeRow.acbr_id
        }

        // Baixar arquivo (PDF ou XML)
        const endpoint = tipo === 'pdf' ? 'pdf' : 'xml';
        const acceptHeader = tipo === 'pdf' ? 'application/pdf' : 'application/xml';

        const fileResponse = await fetch(`${API_BASE}/nfe/${acbrId}/${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${tokenIntegrador}`,
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
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
