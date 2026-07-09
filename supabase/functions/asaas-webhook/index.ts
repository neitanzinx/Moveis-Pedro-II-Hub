import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate webhook secret token sent by Asaas
  const webhookToken = req.headers.get('asaas-access-token');
  const localSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET');

  if (!webhookToken || webhookToken !== localSecret) {
    console.error('Unauthorized webhook request block. Received:', webhookToken);
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log('Asaas Webhook received:', JSON.stringify(body, null, 2));

    const eventId = body.id;
    const eventType = body.event;

    if (!eventId || !eventType) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enforce idempotency: try to log the event ID
    const { error: insertError } = await supabaseAdmin
      .from('asaas_webhook_events')
      .insert({ id: eventId, event_type: eventType });

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`Webhook event duplicate skipped: ${eventId}`);
        return new Response(
          JSON.stringify({ success: true, message: 'Event already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('Error inserting webhook event logger:', insertError);
    }

    // Extract subscription ID from the event payload
    let subscriptionId = '';
    let paymentData = null;

    if (eventType === 'SUBSCRIPTION_DELETED') {
      subscriptionId = body.subscription?.id;
    } else if (body.payment) {
      paymentData = body.payment;
      subscriptionId = paymentData.subscription;
    }

    if (!subscriptionId) {
      console.log(`Webhook event ${eventType} without a subscription ID. Skipping.`);
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored: no subscription context' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process event types
    if (eventType === 'PAYMENT_CONFIRMED' || eventType === 'PAYMENT_RECEIVED') {
      // Find the organization tied to this subscription
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id, plano_id')
        .eq('asaas_subscription_id', subscriptionId)
        .single();

      if (orgError || !org) {
        console.error(`Organization not found for subscription ${subscriptionId}`);
        return new Response(
          JSON.stringify({ error: 'Organization not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Calculate next due date (adding 1 month to the payment's due date)
      const dueDateStr = paymentData?.dueDate;
      let nextBillingDateStr = null;
      if (dueDateStr) {
        const dueDate = new Date(dueDateStr + 'T12:00:00');
        dueDate.setMonth(dueDate.getMonth() + 1);
        nextBillingDateStr = dueDate.toISOString().split('T')[0];
      }

      // Update organization status and next due date
      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({
          status_assinatura: 'ativa',
          proxima_cobranca: nextBillingDateStr
        })
        .eq('id', org.id);

      if (updateOrgError) {
        console.error('Error updating organization status:', updateOrgError);
      }

      // Load resources associated with the selected plan
      if (org.plano_id) {
        const { data: plano, error: planoError } = await supabaseAdmin
          .from('planos')
          .select('recursos')
          .eq('id', org.plano_id)
          .single();

        if (planoError || !plano) {
          console.error('Plan resources load failed:', planoError);
        } else if (plano.recursos) {
          // Enable modules mapped in the plan
          const { error: updateSettingsError } = await supabaseAdmin
            .from('organization_settings')
            .update({ modulos_ativos: plano.recursos })
            .eq('organization_id', org.id);

          if (updateSettingsError) {
            console.error('Error updating organization modules_ativos:', updateSettingsError);
          }
        }
      }

      console.log(`Subscription ${subscriptionId} marked active for org ${org.id}. Next payment: ${nextBillingDateStr}`);

    } else if (eventType === 'PAYMENT_OVERDUE') {
      // Mark subscription as atrasada in DB
      const { error: updateOrgError } = await supabaseAdmin
        .from('organizations')
        .update({ status_assinatura: 'atrasada' })
        .eq('asaas_subscription_id', subscriptionId);

      if (updateOrgError) {
        console.error('Error updating status_assinatura to overdue:', updateOrgError);
      }
      console.log(`Subscription ${subscriptionId} marked overdue (in grace period).`);

    } else if (eventType === 'PAYMENT_DELETED' || eventType === 'SUBSCRIPTION_DELETED') {
      // Cancel organization subscription and clear access settings immediately
      const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('asaas_subscription_id', subscriptionId)
        .single();

      if (org && !orgError) {
        await supabaseAdmin
          .from('organizations')
          .update({ status_assinatura: 'cancelada' })
          .eq('id', org.id);

        // Wipe out modules
        await supabaseAdmin
          .from('organization_settings')
          .update({ modulos_ativos: {} })
          .eq('organization_id', org.id);

        console.log(`Subscription ${subscriptionId} canceled and modules disabled for org ${org.id}.`);
      } else {
        console.warn(`Failed to find organization for canceled subscription ${subscriptionId}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
