// @ts-nocheck - This is a Deno/Supabase Edge Function, not Node.js
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stone API URLs
const STONE_API = {
    sandbox: 'https://sandbox-api.openbank.stone.com.br',
    production: 'https://api.openbank.stone.com.br'
}

const STONE_AUTH = {
    sandbox: 'https://sandbox-accounts.openbank.stone.com.br',
    production: 'https://accounts.openbank.stone.com.br'
}

interface TokenCache {
    token: string;
    expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Obtém token de acesso da Stone via OAuth2 Client Credentials
 */
async function getStoneAccessToken(config: Record<string, string>): Promise<string> {
    // Verificar cache
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
        return tokenCache.token;
    }

    const authUrl = STONE_AUTH[config.stone_ambiente as keyof typeof STONE_AUTH] || STONE_AUTH.sandbox;

    const response = await fetch(`${authUrl}/auth/realms/stone_bank/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: config.stone_client_id,
            client_secret: config.stone_client_secret,
            grant_type: 'client_credentials',
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Stone auth error:', errorText);
        throw new Error(`Stone authentication failed: ${response.status}`);
    }

    const data = await response.json();

    // Cachear token
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ((data.expires_in - 60) * 1000) // Expira 1 minuto antes
    };

    return data.access_token;
}

/**
 * Gera um Transaction ID único para o PIX
 */
function generateTxId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `PIX${timestamp}${random}`.toUpperCase().substring(0, 25);
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get request body
        const body = await req.json();
        const {
            venda_id,
            entrega_id,
            valor,
            numero_pedido,
            cliente_nome,
            cliente_documento,
            descricao
        } = body;

        if (!valor || valor <= 0) {
            return new Response(
                JSON.stringify({ error: 'Valor inválido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch Stone credentials from database
        const { data: configs, error: configError } = await supabaseClient
            .from('configuracoes_sistema')
            .select('chave, valor')
            .in('chave', [
                'stone_client_id',
                'stone_client_secret',
                'stone_account_id',
                'stone_chave_pix',
                'stone_ambiente'
            ])

        if (configError || !configs || configs.length === 0) {
            console.error('Config error:', configError)
            return new Response(
                JSON.stringify({ error: 'Stone não configurado. Adicione as credenciais nas Configurações.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const configMap = configs.reduce((acc, c) => ({ ...acc, [c.chave]: c.valor }), {} as Record<string, string>)

        // Validar configurações obrigatórias
        if (!configMap.stone_client_id || !configMap.stone_client_secret || !configMap.stone_account_id || !configMap.stone_chave_pix) {
            return new Response(
                JSON.stringify({ error: 'Credenciais Stone incompletas. Verifique client_id, client_secret, account_id e chave_pix.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const ambiente = configMap.stone_ambiente || 'sandbox';
        const apiUrl = STONE_API[ambiente as keyof typeof STONE_API];

        // Obter token de acesso
        const accessToken = await getStoneAccessToken(configMap);

        // Gerar Transaction ID
        const txId = generateTxId();

        // Calcular expiração (24 horas)
        const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Preparar payload para Stone PIX
        const pixPayload = {
            amount: Math.round(valor * 100), // Stone usa centavos
            key: configMap.stone_chave_pix,
            transaction_id: txId,
            account_id: configMap.stone_account_id,
            expiration: 86400, // 24 horas em segundos
            customer: cliente_documento ? {
                name: cliente_nome || 'Cliente',
                document: cliente_documento.replace(/\D/g, ''),
            } : undefined,
            request_for_payer: descricao || `Pedido #${numero_pedido || 'N/A'} - Móveis Pedro II`,
        };

        console.log('Creating Stone PIX:', JSON.stringify(pixPayload, null, 2));

        // Chamar API Stone para criar cobrança PIX
        const stoneResponse = await fetch(`${apiUrl}/api/v1/pix_payment_invoices`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-stone-account-id': configMap.stone_account_id,
                'x-stone-idempotency-key': txId,
            },
            body: JSON.stringify(pixPayload)
        });

        const responseText = await stoneResponse.text();
        console.log('Stone response status:', stoneResponse.status);
        console.log('Stone response:', responseText);

        if (!stoneResponse.ok) {
            return new Response(
                JSON.stringify({
                    error: 'Erro na API Stone',
                    details: responseText,
                    status: stoneResponse.status
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const stoneData = JSON.parse(responseText);

        // Extrair dados do QR Code
        const qrCodeContent = stoneData.qr_code_content || stoneData.emv || '';
        const qrCodeImage = stoneData.qr_code_image || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeContent)}`;

        // Salvar cobrança no banco de dados
        const cobrancaData = {
            venda_id: venda_id || null,
            entrega_id: entrega_id || null,
            stone_txid: txId,
            stone_location: stoneData.location || null,
            qr_code_content: qrCodeContent,
            qr_code_image: qrCodeImage,
            pix_copia_cola: qrCodeContent,
            valor: valor,
            status: 'ATIVA',
            data_expiracao: expiracao.toISOString(),
            descricao: descricao || `Pedido #${numero_pedido || 'N/A'}`,
            numero_pedido: numero_pedido,
            pagador_nome: cliente_nome || null,
            pagador_documento: cliente_documento || null,
        };

        const { data: cobranca, error: insertError } = await supabaseClient
            .from('cobrancas_pix')
            .insert(cobrancaData)
            .select()
            .single();

        if (insertError) {
            console.error('Error saving cobranca:', insertError);
        }

        // Se tiver venda_id, atualizar a venda com o link
        if (venda_id) {
            await supabaseClient
                .from('vendas')
                .update({
                    link_pagamento: qrCodeContent,
                    status_pagamento: 'AGUARDANDO_PAGAMENTO'
                })
                .eq('id', venda_id);
        }

        return new Response(
            JSON.stringify({
                success: true,
                txid: txId,
                qr_code_content: qrCodeContent,
                qr_code_image: qrCodeImage,
                pix_copia_cola: qrCodeContent,
                valor: valor,
                expiracao: expiracao.toISOString(),
                cobranca_id: cobranca?.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Stone PIX error:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
