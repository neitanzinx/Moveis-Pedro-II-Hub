// Supabase Edge Function: cancelar-nfe
// Deploy: supabase functions deploy cancelar-nfe --no-verify-jwt

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
        const { nfe_id, justificativa, ambiente = 'homologacao' } = await req.json()

        if (!nfe_id) {
            return new Response(
                JSON.stringify({ error: 'nfe_id é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!justificativa || justificativa.length < 15) {
            return new Response(
                JSON.stringify({ error: 'Justificativa deve ter no mínimo 15 caracteres' }),
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

        // Cancelar NFe
        const cancelResponse = await fetch(`${API_BASE}/nfe/${nfe_id}/cancelamento`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ justificativa })
        });

        const cancelData = await cancelResponse.json();

        if (!cancelResponse.ok) {
            throw new Error(cancelData.message || 'Erro ao cancelar NFe');
        }

        // Atualizar status no banco
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        await supabase
            .from('notas_fiscais_emitidas')
            .update({
                status: 'Cancelada',
                motivo_status: justificativa,
                updated_at: new Date().toISOString()
            })
            .eq('nuvem_fiscal_id', nfe_id);

        return new Response(
            JSON.stringify({
                success: true,
                status: 'Cancelada',
                protocolo: cancelData.protocolo,
                mensagem: 'NFe cancelada com sucesso'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
