// Supabase Edge Function: importar-nfe
// Deploy: supabase functions deploy importar-nfe --no-verify-jwt
// 
// Esta função processa a importação de NFe de entrada de forma segura.
// Secrets: NUVEM_FISCAL_HOMOLOG_ID, NUVEM_FISCAL_HOMOLOG_SECRET, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { chave_acesso, cnpj_destinatario, ambiente = 'homologacao', acao = 'buscar' } = await req.json()

        // Validações
        if (!chave_acesso || chave_acesso.replace(/\D/g, '').length !== 44) {
            return new Response(
                JSON.stringify({ error: 'Chave de acesso inválida (deve ter 44 dígitos)' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!cnpj_destinatario) {
            return new Response(
                JSON.stringify({ error: 'CNPJ do destinatário é obrigatório' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Credenciais seguras do Supabase secrets
        const CLIENT_ID = ambiente === 'producao'
            ? Deno.env.get('NUVEM_FISCAL_PROD_ID')
            : Deno.env.get('NUVEM_FISCAL_HOMOLOG_ID');

        const CLIENT_SECRET = ambiente === 'producao'
            ? Deno.env.get('NUVEM_FISCAL_PROD_SECRET')
            : Deno.env.get('NUVEM_FISCAL_HOMOLOG_SECRET');

        if (!CLIENT_ID || !CLIENT_SECRET) {
            return new Response(
                JSON.stringify({
                    error: 'Credenciais não configuradas. Execute: supabase secrets set NUVEM_FISCAL_HOMOLOG_ID=xxx NUVEM_FISCAL_HOMOLOG_SECRET=xxx',
                    configurado: false
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const API_BASE = ambiente === 'producao'
            ? 'https://api.nuvemfiscal.com.br'
            : 'https://api.sandbox.nuvemfiscal.com.br';

        // 1. Autenticar na Nuvem Fiscal
        const authResponse = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                scope: 'nfe distribuicao-nfe'
            })
        });

        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            throw new Error(`Falha na autenticação: ${authResponse.status} - ${errorText}`);
        }

        const { access_token } = await authResponse.json();
        const chaveLimpa = chave_acesso.replace(/\D/g, '');

        // 2. Buscar documento na distribuição
        let documentoId = null;

        const buscaResponse = await fetch(
            `${API_BASE}/distribuicao/nfe/documentos?cpf_cnpj=${cnpj_destinatario}&chave_acesso=${chaveLimpa}&ambiente=${ambiente}`,
            {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${access_token}` }
            }
        );

        if (buscaResponse.ok) {
            const buscaData = await buscaResponse.json();
            documentoId = buscaData.data?.[0]?.id;
        }

        // 3. Se não encontrou, manifestar ciência
        if (!documentoId && acao === 'buscar') {
            const manifestResponse = await fetch(`${API_BASE}/distribuicao/nfe/manifestacoes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cpf_cnpj: cnpj_destinatario,
                    chave_acesso: chaveLimpa,
                    tipo_evento: 'ciencia_operacao',
                    ambiente: ambiente
                })
            });

            if (!manifestResponse.ok) {
                console.log('Manifestação pendente ou já realizada');
            }

            // Aguardar processamento e buscar novamente
            await new Promise(r => setTimeout(r, 3000));

            const novaBusca = await fetch(
                `${API_BASE}/distribuicao/nfe/documentos?cpf_cnpj=${cnpj_destinatario}&chave_acesso=${chaveLimpa}&ambiente=${ambiente}`,
                {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${access_token}` }
                }
            );

            if (novaBusca.ok) {
                const novaBuscaData = await novaBusca.json();
                documentoId = novaBuscaData.data?.[0]?.id;
            }
        }

        if (!documentoId) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Nota não localizada na SEFAZ. Aguarde 1-2 minutos e tente novamente.',
                    status: 'aguardando'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Baixar XML completo do documento
        const xmlResponse = await fetch(`${API_BASE}/distribuicao/nfe/documentos/${documentoId}/xml`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/xml'
            }
        });

        if (!xmlResponse.ok) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'XML ainda não disponível. A SEFAZ está processando.',
                    documento_id: documentoId,
                    status: 'processando'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const xmlContent = await xmlResponse.text();

        return new Response(
            JSON.stringify({
                success: true,
                documento_id: documentoId,
                xml: xmlContent,
                ambiente
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Erro:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
