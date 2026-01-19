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

// Payment status mapping
const STATUS_MAP: Record<string, string> = {
    'AUTHORIZED': 'AUTORIZADO',
    'PAID': 'PAGO',
    'IN_ANALYSIS': 'EM_ANALISE',
    'DECLINED': 'RECUSADO',
    'CANCELED': 'CANCELADO',
    'WAITING': 'AGUARDANDO_PAGAMENTO'
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

        // PagSeguro sends notifications as form-urlencoded or JSON
        const contentType = req.headers.get('content-type') || ''
        let notificationCode: string | null = null
        let chargeId: string | null = null

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.formData()
            notificationCode = formData.get('notificationCode') as string
        } else if (contentType.includes('application/json')) {
            const body = await req.json()
            // PagSeguro v4 sends charge updates
            chargeId = body.id || body.charge_id
            if (body.charges && body.charges.length > 0) {
                chargeId = body.charges[0].id
            }
            console.log('Webhook received:', JSON.stringify(body, null, 2))
        }

        if (!notificationCode && !chargeId) {
            // Try to get from URL params
            const url = new URL(req.url)
            notificationCode = url.searchParams.get('notificationCode')
            chargeId = url.searchParams.get('charge_id')
        }

        console.log('Processing notification:', { notificationCode, chargeId })

        // Fetch PagSeguro credentials
        const { data: configs } = await supabaseClient
            .from('configuracoes_sistema')
            .select('chave, valor')
            .in('chave', ['pagseguro_token', 'pagseguro_ambiente'])

        const configMap = configs?.reduce((acc, c) => ({ ...acc, [c.chave]: c.valor }), {} as Record<string, string>) || {}
        const token = configMap.pagseguro_token
        const ambiente = configMap.pagseguro_ambiente || 'sandbox'
        const apiUrl = PAGSEGURO_API[ambiente as keyof typeof PAGSEGURO_API]

        if (!token) {
            console.error('PagSeguro token not configured')
            return new Response(
                JSON.stringify({ error: 'Token not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let checkoutId: string | null = null
        let paymentStatus: string = 'AGUARDANDO_PAGAMENTO'
        let transactionId: string | null = null

        // If we have a charge ID (v4 API), fetch charge details
        if (chargeId) {
            const chargeResponse = await fetch(`${apiUrl}/charges/${chargeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-api-version': '4.0'
                }
            })

            if (chargeResponse.ok) {
                const chargeData = await chargeResponse.json()
                console.log('Charge data:', JSON.stringify(chargeData, null, 2))

                checkoutId = chargeData.reference_id
                transactionId = chargeData.id
                paymentStatus = STATUS_MAP[chargeData.status] || chargeData.status
            }
        }

        // If we have a notification code (v3 API), fetch transaction details
        if (notificationCode && !checkoutId) {
            const notifResponse = await fetch(
                `${apiUrl}/v3/transactions/notifications/${notificationCode}?email=${configMap.pagseguro_email}&token=${token}`
            )

            if (notifResponse.ok) {
                const xmlText = await notifResponse.text()
                // Simple XML parsing for reference and status
                const referenceMatch = xmlText.match(/<reference>([^<]+)<\/reference>/)
                const statusMatch = xmlText.match(/<status>(\d+)<\/status>/)
                const codeMatch = xmlText.match(/<code>([^<]+)<\/code>/)

                if (referenceMatch) checkoutId = referenceMatch[1]
                if (codeMatch) transactionId = codeMatch[1]

                // Map PagSeguro v3 status codes
                const v3StatusMap: Record<string, string> = {
                    '1': 'AGUARDANDO_PAGAMENTO',
                    '2': 'EM_ANALISE',
                    '3': 'PAGO',
                    '4': 'DISPONIVEL',
                    '5': 'EM_DISPUTA',
                    '6': 'DEVOLVIDO',
                    '7': 'CANCELADO',
                    '8': 'DEBITADO',
                    '9': 'RETENCAO_TEMPORARIA'
                }
                if (statusMatch) {
                    paymentStatus = v3StatusMap[statusMatch[1]] || 'DESCONHECIDO'
                }
            }
        }

        // Update the sale in database
        if (checkoutId) {
            const updateData: Record<string, any> = {
                status_pagamento: paymentStatus,
                transaction_id: transactionId || null
            }

            // Set payment date if paid
            if (['PAGO', 'DISPONIVEL', 'AUTHORIZED'].includes(paymentStatus)) {
                updateData.data_pagamento = new Date().toISOString()
            }

            // Try to find by checkout_id first
            let { data: venda, error } = await supabaseClient
                .from('vendas')
                .update(updateData)
                .eq('checkout_id', checkoutId)
                .select()
                .single()

            // If not found by checkout_id, try by id (reference_id is the venda_id)
            if (error || !venda) {
                const { data: vendaById, error: errorById } = await supabaseClient
                    .from('vendas')
                    .update(updateData)
                    .eq('id', checkoutId)
                    .select()
                    .single()

                if (errorById) {
                    console.error('Error updating venda:', errorById)
                } else {
                    console.log('Venda updated by ID:', vendaById?.id)
                }
            } else {
                console.log('Venda updated by checkout_id:', venda?.id)
            }
        }

        return new Response(
            JSON.stringify({ success: true, processed: { checkoutId, paymentStatus } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Webhook error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
