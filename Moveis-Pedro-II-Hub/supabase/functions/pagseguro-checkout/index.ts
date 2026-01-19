import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PagSeguro API URLs
const PAGSEGURO_API = {
    sandbox: 'https://sandbox.api.pagseguro.com',
    production: 'https://api.pagseguro.com'
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
        const { venda_id, itens, cliente, valor_total, numero_pedido } = await req.json()

        if (!venda_id || !itens || !cliente || !valor_total) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Fetch PagSeguro credentials from database
        const { data: configs, error: configError } = await supabaseClient
            .from('configuracoes_sistema')
            .select('chave, valor')
            .in('chave', ['pagseguro_token', 'pagseguro_email', 'pagseguro_ambiente'])

        if (configError || !configs || configs.length === 0) {
            console.error('Config error:', configError)
            return new Response(
                JSON.stringify({ error: 'PagSeguro not configured. Please add credentials in Settings.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const configMap = configs.reduce((acc, c) => ({ ...acc, [c.chave]: c.valor }), {} as Record<string, string>)
        const token = configMap.pagseguro_token
        const ambiente = configMap.pagseguro_ambiente || 'sandbox'

        if (!token) {
            return new Response(
                JSON.stringify({ error: 'PagSeguro token not configured' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const apiUrl = PAGSEGURO_API[ambiente as keyof typeof PAGSEGURO_API]

        // Build checkout request for PagSeguro API v4
        const checkoutPayload = {
            reference_id: venda_id,
            customer: {
                name: cliente.nome || 'Cliente',
                email: cliente.email || 'cliente@email.com',
                tax_id: cliente.cpf?.replace(/\D/g, '') || undefined,
                phones: cliente.telefone ? [{
                    country: '55',
                    area: cliente.telefone.replace(/\D/g, '').substring(0, 2),
                    number: cliente.telefone.replace(/\D/g, '').substring(2),
                    type: 'MOBILE'
                }] : undefined
            },
            items: itens.map((item: any, index: number) => ({
                reference_id: `item_${index}`,
                name: item.produto_nome || item.nome || 'Produto',
                quantity: item.quantidade || 1,
                unit_amount: Math.round((item.preco_unitario || item.valor || 0) * 100) // PagSeguro uses cents
            })),
            shipping: {
                type: 'FIXED',
                amount: {
                    value: 0,
                    currency: 'BRL'
                }
            },
            notification_urls: [
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/pagseguro-webhook`
            ],
            redirect_urls: {
                return_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}/vendas?pagamento=sucesso`,
                cancel_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}/vendas?pagamento=cancelado`
            },
            expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            payment_methods: [
                { type: 'CREDIT_CARD' },
                { type: 'DEBIT_CARD' },
                { type: 'BOLETO' },
                { type: 'PIX' }
            ],
            payment_methods_configs: [
                {
                    type: 'CREDIT_CARD',
                    config_options: [
                        { option: 'INSTALLMENTS_LIMIT', value: '12' }
                    ]
                }
            ],
            soft_descriptor: `Moveis Pedro II - ${numero_pedido || ''}`
        }

        console.log('Creating PagSeguro checkout:', JSON.stringify(checkoutPayload, null, 2))

        // Call PagSeguro Checkout API
        const pagseguroResponse = await fetch(`${apiUrl}/checkouts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-api-version': '4.0'
            },
            body: JSON.stringify(checkoutPayload)
        })

        const responseText = await pagseguroResponse.text()
        console.log('PagSeguro response status:', pagseguroResponse.status)
        console.log('PagSeguro response:', responseText)

        if (!pagseguroResponse.ok) {
            return new Response(
                JSON.stringify({
                    error: 'PagSeguro API error',
                    details: responseText,
                    status: pagseguroResponse.status
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const checkoutData = JSON.parse(responseText)

        // Extract payment link and QR code (if available)
        const linkPagamento = checkoutData.links?.find((l: any) => l.rel === 'PAY')?.href ||
            `https://pagseguro.uol.com.br/v2/checkout/payment.html?code=${checkoutData.id}`

        // Update venda with checkout info
        const { error: updateError } = await supabaseClient
            .from('vendas')
            .update({
                link_pagamento: linkPagamento,
                checkout_id: checkoutData.id,
                status_pagamento: 'AGUARDANDO_PAGAMENTO'
            })
            .eq('id', venda_id)

        if (updateError) {
            console.error('Error updating venda:', updateError)
        }

        // Generate QR Code URL (using external service for simplicity)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(linkPagamento)}`

        return new Response(
            JSON.stringify({
                success: true,
                link_pagamento: linkPagamento,
                qr_code_url: qrCodeUrl,
                checkout_id: checkoutData.id
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Checkout error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
