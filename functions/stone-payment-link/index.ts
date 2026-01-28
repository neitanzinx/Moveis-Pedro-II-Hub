// @ts-nocheck - This is a Deno/Supabase Edge Function
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
async function getStoneAccessToken(config: {
    client_id: string;
    client_secret: string;
    environment: string;
}): Promise<string> {
    // Verificar cache
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
        return tokenCache.token;
    }

    const authUrl = config.environment === 'production'
        ? STONE_AUTH.production
        : STONE_AUTH.sandbox;

    const response = await fetch(`${authUrl}/auth/realms/stone_bank/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: config.client_id,
            client_secret: config.client_secret,
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
        expiresAt: Date.now() + ((data.expires_in - 60) * 1000)
    };

    return data.access_token;
}

/**
 * Gera um ID único para o link de pagamento
 */
function generatePaymentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `PAY${timestamp}${random}`.toUpperCase().substring(0, 25);
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

        // Determine action from URL path
        const url = new URL(req.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const action = pathParts[pathParts.length - 1] || 'create';

        // Route to appropriate handler
        switch (action) {
            case 'create':
                return await handleCreatePaymentLink(req, supabaseClient);
            case 'status':
                return await handleCheckStatus(req, supabaseClient);
            case 'webhook':
                return await handleWebhook(req, supabaseClient);
            default:
                return new Response(
                    JSON.stringify({ error: 'Action not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
        }
    } catch (error) {
        console.error('Stone Payment Link error:', error);
        return new Response(
            JSON.stringify({ error: 'Erro interno', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

/**
 * Cria um novo link de pagamento
 */
async function handleCreatePaymentLink(req: Request, supabaseClient: any) {
    const body = await req.json();
    const {
        venda_id,
        valor,
        descricao,
        cliente_nome,
        cliente_email,
        cliente_documento,
        payment_methods = ['pix', 'credit_card', 'boleto'],
        max_installments = 12,
        expires_in_days = 7
    } = body;

    if (!valor || valor <= 0) {
        return new Response(
            JSON.stringify({ error: 'Valor inválido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Fetch Stone config from new table
    const { data: stoneConfig, error: configError } = await supabaseClient
        .from('stone_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (configError || !stoneConfig) {
        console.error('Config error:', configError);
        return new Response(
            JSON.stringify({ error: 'Stone não configurado. Configure nas Configurações → Pagamentos → Stone.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Validate required credentials
    if (!stoneConfig.client_id || !stoneConfig.client_secret) {
        return new Response(
            JSON.stringify({ error: 'Credenciais Stone incompletas.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const environment = stoneConfig.environment || 'sandbox';
    const apiUrl = environment === 'production' ? STONE_API.production : STONE_API.sandbox;

    // Get access token
    const accessToken = await getStoneAccessToken({
        client_id: stoneConfig.client_id,
        client_secret: stoneConfig.client_secret,
        environment
    });

    // Generate unique payment ID
    const paymentId = generatePaymentId();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Prepare payload for Stone Payment Link
    const paymentLinkPayload = {
        amount: Math.round(valor * 100), // Stone uses cents
        description: descricao || `Pagamento - Móveis Pedro II`,
        expiration_date: expiresAt.toISOString(),
        payment_methods: payment_methods,
        max_installments: max_installments,
        customer: cliente_nome ? {
            name: cliente_nome,
            email: cliente_email || undefined,
            document: cliente_documento?.replace(/\D/g, '') || undefined
        } : undefined,
        external_reference: paymentId,
        metadata: {
            venda_id: venda_id || null,
            source: 'moveis-pedro-ii'
        }
    };

    console.log('Creating Stone Payment Link:', JSON.stringify(paymentLinkPayload, null, 2));

    // Call Stone API to create payment link
    const stoneResponse = await fetch(`${apiUrl}/api/v1/payment-links`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'x-stone-idempotency-key': paymentId,
        },
        body: JSON.stringify(paymentLinkPayload)
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

    // Save payment link to database
    const paymentLinkData = {
        venda_id: venda_id || null,
        stone_id: stoneData.id || paymentId,
        amount: Math.round(valor * 100),
        description: descricao,
        customer_name: cliente_nome,
        customer_email: cliente_email,
        customer_document: cliente_documento,
        payment_url: stoneData.url || stoneData.link_url,
        qr_code: stoneData.qr_code || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        metadata: { stone_response: stoneData }
    };

    const { data: paymentLink, error: insertError } = await supabaseClient
        .from('payment_links')
        .insert(paymentLinkData)
        .select()
        .single();

    if (insertError) {
        console.error('Error saving payment link:', insertError);
    }

    // If venda_id provided, update the sale
    if (venda_id) {
        await supabaseClient
            .from('vendas')
            .update({
                link_pagamento: stoneData.url || stoneData.link_url,
                status_pagamento: 'AGUARDANDO_PAGAMENTO'
            })
            .eq('id', venda_id);
    }

    return new Response(
        JSON.stringify({
            success: true,
            id: paymentLink?.id,
            stone_id: stoneData.id,
            payment_url: stoneData.url || stoneData.link_url,
            qr_code: stoneData.qr_code,
            valor: valor,
            expires_at: expiresAt.toISOString(),
            status: 'pending'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

/**
 * Verifica status de um link de pagamento
 */
async function handleCheckStatus(req: Request, supabaseClient: any) {
    const url = new URL(req.url);
    const paymentLinkId = url.searchParams.get('id');

    if (!paymentLinkId) {
        return new Response(
            JSON.stringify({ error: 'ID do link de pagamento é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Get payment link from database
    const { data: paymentLink, error } = await supabaseClient
        .from('payment_links')
        .select('*')
        .eq('id', paymentLinkId)
        .single();

    if (error || !paymentLink) {
        return new Response(
            JSON.stringify({ error: 'Link de pagamento não encontrado' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    return new Response(
        JSON.stringify({
            id: paymentLink.id,
            stone_id: paymentLink.stone_id,
            status: paymentLink.status,
            payment_method: paymentLink.payment_method,
            paid_at: paymentLink.paid_at,
            amount: paymentLink.amount / 100, // Convert back to reais
            payment_url: paymentLink.payment_url
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

/**
 * Processa webhook da Stone
 */
async function handleWebhook(req: Request, supabaseClient: any) {
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const body = await req.json();

    console.log('Stone webhook received:', JSON.stringify(body, null, 2));

    // Log webhook to database
    const webhookLog = {
        event_type: body.event_type || body.type || 'unknown',
        stone_event_id: body.id || body.event_id,
        payload: body,
        processed: false
    };

    await supabaseClient.from('stone_webhooks').insert(webhookLog);

    // Process payment confirmation
    const eventType = body.event_type || body.type;

    if (eventType === 'payment_link.paid' || eventType === 'payment.completed') {
        const paymentLinkId = body.data?.payment_link_id || body.data?.external_reference;

        if (paymentLinkId) {
            // Update payment link status
            const { data: paymentLink, error: updateError } = await supabaseClient
                .from('payment_links')
                .update({
                    status: 'paid',
                    payment_method: body.data?.payment_method || 'unknown',
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('stone_id', paymentLinkId)
                .select()
                .single();

            if (!updateError && paymentLink?.venda_id) {
                // Update related sale
                await supabaseClient
                    .from('vendas')
                    .update({
                        status_pagamento: 'PAGO',
                        data_pagamento: new Date().toISOString()
                    })
                    .eq('id', paymentLink.venda_id);
            }

            // Mark webhook as processed
            await supabaseClient
                .from('stone_webhooks')
                .update({ processed: true, payment_link_id: paymentLink?.id })
                .eq('stone_event_id', body.id || body.event_id);
        }
    }

    // Stone expects 200 OK to acknowledge receipt
    return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}
