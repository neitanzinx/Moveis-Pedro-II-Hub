import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const asaasUrl = Deno.env.get('ASAAS_API_URL') || 'https://api-sandbox.asaas.com/v3';
  const asaasKey = Deno.env.get('ASAAS_API_KEY') || '';

  if (!asaasKey) {
    return new Response(
      JSON.stringify({ error: 'Asaas API Key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': asaasKey
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate the user calling this function
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize service client to modify DB tables
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch user's organization_id from profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = profile.organization_id;

    // Parse request body
    const { planoId, paymentMethod, cardDetails, action = 'create' } = await req.json().catch(() => ({}));

    // Action: Cancel Subscription
    if (action === 'cancel') {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('asaas_subscription_id')
        .eq('id', orgId)
        .single();

      if (orgError || !org || !org.asaas_subscription_id) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found to cancel' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Call Asaas DELETE subscription
      const asaasResponse = await fetch(`${asaasUrl}/subscriptions/${org.asaas_subscription_id}`, {
        method: 'DELETE',
        headers: asaasHeaders
      });

      if (!asaasResponse.ok) {
        const errText = await asaasResponse.text();
        console.error('Asaas delete subscription error:', errText);
        return new Response(
          JSON.stringify({ error: `Asaas error: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mark database as cancelada (will clear module access fully upon webhook execution)
      await supabaseAdmin
        .from('organizations')
        .update({ status_assinatura: 'cancelada' })
        .eq('id', orgId);

      return new Response(
        JSON.stringify({ success: true, message: 'Subscription canceled successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Get pending payment details
    if (action === 'get-pending-payment') {
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('asaas_subscription_id')
        .eq('id', orgId)
        .single();

      if (orgError || !org || !org.asaas_subscription_id) {
        return new Response(
          JSON.stringify({ error: 'Subscription not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const paymentsResponse = await fetch(`${asaasUrl}/subscriptions/${org.asaas_subscription_id}/payments?status=PENDING`, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (!paymentsResponse.ok) {
        const errText = await paymentsResponse.text();
        return new Response(
          JSON.stringify({ error: `Asaas error: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const paymentsData = await paymentsResponse.json();
      if (!paymentsData.data || paymentsData.data.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No pending payments found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const payment = paymentsData.data[0];

      if (payment.billingType === 'PIX') {
        const pixResponse = await fetch(`${asaasUrl}/payments/${payment.id}/pixQrCode`, {
          method: 'GET',
          headers: asaasHeaders
        });

        if (pixResponse.ok) {
          const pixData = await pixResponse.json();
          return new Response(
            JSON.stringify({
              subscriptionId: org.asaas_subscription_id,
              paymentId: payment.id,
              billingType: 'PIX',
              invoiceUrl: payment.invoiceUrl,
              pixQrCode: pixData.encodedImage,
              pixCopiaCola: pixData.payload,
              dueDate: payment.dueDate,
              value: payment.value
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({
          subscriptionId: org.asaas_subscription_id,
          paymentId: payment.id,
          billingType: payment.billingType,
          invoiceUrl: payment.invoiceUrl,
          bankSlipUrl: payment.bankSlipUrl,
          dueDate: payment.dueDate,
          value: payment.value
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Create or Update Subscription (Subscribe / Upgrade / Downgrade)
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!planoId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Missing planoId or paymentMethod' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: plano, error: planoError } = await supabaseAdmin
      .from('planos')
      .select('*')
      .eq('id', planoId)
      .single();

    if (planoError || !plano) {
      return new Response(
        JSON.stringify({ error: 'Plan not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Create Customer in Asaas if they don't have one
    let customerId = org.asaas_customer_id;
    if (!customerId) {
      const customerPayload = {
        name: org.razao_social || org.name,
        cpfCnpj: org.cnpj ? org.cnpj.replace(/\D/g, '') : undefined,
        email: org.email_suporte || undefined,
        mobilePhone: org.whatsapp_suporte ? org.whatsapp_suporte.replace(/\D/g, '') : undefined,
      };

      const createCustomerRes = await fetch(`${asaasUrl}/customers`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(customerPayload)
      });

      if (!createCustomerRes.ok) {
        const errText = await createCustomerRes.text();
        console.error('Asaas customer creation failed:', errText);
        return new Response(
          JSON.stringify({ error: `Asaas customer creation failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const customerData = await createCustomerRes.json();
      customerId = customerData.id;

      await supabaseAdmin
        .from('organizations')
        .update({ asaas_customer_id: customerId })
        .eq('id', orgId);
    }

    // Calculate today's date in Sao Paulo timezone (UTC-3)
    const date = new Date();
    const brtDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const nextDueDate = brtDate.toISOString().split('T')[0];

    let subscriptionId = org.asaas_subscription_id;
    const isNewSub = !subscriptionId;

    if (isNewSub) {
      // 2. Create Subscription in Asaas
      const subscriptionPayload: any = {
        customer: customerId,
        billingType: paymentMethod, // "PIX", "BOLETO", "CREDIT_CARD"
        value: plano.preco_mensal,
        nextDueDate: nextDueDate,
        cycle: 'MONTHLY',
        description: `Assinatura de Plano - ${plano.nome}`,
        remoteIp: req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1',
      };

      if (paymentMethod === 'CREDIT_CARD') {
        if (!cardDetails) {
          return new Response(
            JSON.stringify({ error: 'Missing credit card details' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        subscriptionPayload.creditCard = {
          holderName: cardDetails.holderName,
          number: cardDetails.number.replace(/\D/g, ''),
          expiryMonth: cardDetails.expiryMonth,
          expiryYear: cardDetails.expiryYear,
          ccv: cardDetails.ccv
        };
        subscriptionPayload.creditCardHolderInfo = {
          name: cardDetails.holderName,
          email: org.email_suporte || cardDetails.email,
          cpfCnpj: org.cnpj ? org.cnpj.replace(/\D/g, '') : cardDetails.cpfCnpj.replace(/\D/g, ''),
          postalCode: cardDetails.postalCode?.replace(/\D/g, ''),
          addressNumber: cardDetails.addressNumber || '1',
          phone: org.whatsapp_suporte ? org.whatsapp_suporte.replace(/\D/g, '') : cardDetails.phone?.replace(/\D/g, ''),
        };
      }

      const createSubRes = await fetch(`${asaasUrl}/subscriptions`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(subscriptionPayload)
      });

      if (!createSubRes.ok) {
        const errText = await createSubRes.text();
        console.error('Asaas subscription creation failed:', errText);
        return new Response(
          JSON.stringify({ error: `Asaas subscription creation failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const subData = await createSubRes.json();
      subscriptionId = subData.id;

      await supabaseAdmin
        .from('organizations')
        .update({
          plano_id: plano.id,
          asaas_subscription_id: subscriptionId,
          status_assinatura: 'processando',
          proxima_cobranca: nextDueDate
        })
        .eq('id', orgId);

    } else {
      // 3. Update Existing Subscription (Upgrade/Downgrade)
      const updatePayload: any = {
        value: plano.preco_mensal,
        billingType: paymentMethod,
        description: `Alteração Plano - ${plano.nome}`,
        updatePendingPayments: true
      };

      if (paymentMethod === 'CREDIT_CARD') {
        if (!cardDetails) {
          return new Response(
            JSON.stringify({ error: 'Missing credit card details' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        updatePayload.creditCard = {
          holderName: cardDetails.holderName,
          number: cardDetails.number.replace(/\D/g, ''),
          expiryMonth: cardDetails.expiryMonth,
          expiryYear: cardDetails.expiryYear,
          ccv: cardDetails.ccv
        };
        updatePayload.creditCardHolderInfo = {
          name: cardDetails.holderName,
          email: org.email_suporte || cardDetails.email,
          cpfCnpj: org.cnpj ? org.cnpj.replace(/\D/g, '') : cardDetails.cpfCnpj.replace(/\D/g, ''),
          postalCode: cardDetails.postalCode?.replace(/\D/g, ''),
          addressNumber: cardDetails.addressNumber || '1',
          phone: org.whatsapp_suporte ? org.whatsapp_suporte.replace(/\D/g, '') : cardDetails.phone?.replace(/\D/g, ''),
        };
      }

      const updateSubRes = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}`, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(updatePayload)
      });

      if (!updateSubRes.ok) {
        const errText = await updateSubRes.text();
        console.error('Asaas subscription update failed:', errText);
        return new Response(
          JSON.stringify({ error: `Asaas subscription update failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabaseAdmin
        .from('organizations')
        .update({
          plano_id: plano.id,
          status_assinatura: 'processando'
        })
        .eq('id', orgId);
    }

    // 4. Retrieve details of the current pending invoice
    const paymentsResponse = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}/payments?status=PENDING`, {
      method: 'GET',
      headers: asaasHeaders
    });

    if (!paymentsResponse.ok) {
      const errText = await paymentsResponse.text();
      console.error('Asaas payments fetch failed:', errText);
      return new Response(
        JSON.stringify({
          success: true,
          subscriptionId,
          message: 'Assinatura criada/atualizada. Detalhes de pagamento indisponíveis no momento.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentsData = await paymentsResponse.json();
    if (!paymentsData.data || paymentsData.data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          subscriptionId,
          message: 'Assinatura criada/atualizada com sucesso.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payment = paymentsData.data[0];

    if (paymentMethod === 'PIX') {
      const pixResponse = await fetch(`${asaasUrl}/payments/${payment.id}/pixQrCode`, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (pixResponse.ok) {
        const pixData = await pixResponse.json();
        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId,
            paymentId: payment.id,
            billingType: 'PIX',
            invoiceUrl: payment.invoiceUrl,
            pixQrCode: pixData.encodedImage,
            pixCopiaCola: pixData.payload,
            dueDate: payment.dueDate,
            value: payment.value
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId,
        paymentId: payment.id,
        billingType: payment.billingType,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        dueDate: payment.dueDate,
        value: payment.value
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in Edge Function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
