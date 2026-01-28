// Supabase Edge Function: baixar-nfe
// Deploy: supabase functions deploy baixar-nfe --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

        const CLIENT_ID = ambiente === 'producao'
            ? Deno.env.get('NUVEM_FISCAL_PROD_ID')
            : Deno.env.get('NUVEM_FISCAL_HOMOLOG_ID');

        const CLIENT_SECRET = ambiente === 'producao'
            ? Deno.env.get('NUVEM_FISCAL_PROD_SECRET')
            : Deno.env.get('NUVEM_FISCAL_HOMOLOG_SECRET');

        if (!CLIENT_ID || !CLIENT_SECRET) {
            return new Response(
                JSON.stringify({ error: 'Credenciais não configuradas', configurado: false }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const API_BASE = ambiente === 'producao'
            ? 'https://api.nuvemfiscal.com.br'
            : 'https://api.sandbox.nuvemfiscal.com.br';

        // Autenticar
        const authResponse = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                scope: 'nfe'
            })
        });

        if (!authResponse.ok) {
            throw new Error('Falha na autenticação');
        }

        const { access_token } = await authResponse.json();

        // Baixar arquivo (PDF ou XML)
        const endpoint = tipo === 'pdf' ? 'pdf' : 'xml';
        const acceptHeader = tipo === 'pdf' ? 'application/pdf' : 'application/xml';

        const fileResponse = await fetch(`${API_BASE}/nfe/${nfe_id}/${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
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
