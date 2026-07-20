import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const asaasKey = Deno.env.get('ASAAS_API_KEY') || '';
  const defaultUrl = (asaasKey.trim().startsWith('$aae') || asaasKey.trim().startsWith('$aact_prod')) 
    ? 'https://api.asaas.com/v3' 
    : 'https://api-sandbox.asaas.com/v3';
  const asaasUrl = Deno.env.get('ASAAS_API_URL') || defaultUrl;

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
    const {
      // Dados da empresa
      nomeEmpresa,
      cnpj,
      emailEmpresa,
      whatsappEmpresa,
      logoUrl,
      // Dados do admin
      nomeAdmin,
      emailAdmin,
      senhaAdmin,
      // Plano e pagamento
      planoId,
      paymentMethod,
      cardDetails
    } = await req.json();

    // ========== VALIDAÇÕES ==========
    if (!nomeEmpresa || !cnpj || !emailEmpresa) {
      return new Response(
        JSON.stringify({ error: 'Dados da empresa são obrigatórios (nome, CNPJ, email).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!nomeAdmin || !emailAdmin || !senhaAdmin) {
      return new Response(
        JSON.stringify({ error: 'Dados do administrador são obrigatórios (nome, email, senha).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!planoId || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Plano e forma de pagamento são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== 1. VERIFICAR SE EMAIL JÁ EXISTE ==========
    const { data: existingUsers } = await supabaseAdmin
      .from('public_users')
      .select('id')
      .eq('email', emailAdmin)
      .limit(1);

    if (existingUsers && existingUsers.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Este email já está cadastrado no sistema.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== 2. BUSCAR PLANO ==========
    const { data: plano, error: planoError } = await supabaseAdmin
      .from('planos')
      .select('*')
      .eq('id', planoId)
      .eq('ativo', true)
      .single();

    if (planoError || !plano) {
      return new Response(
        JSON.stringify({ error: 'Plano não encontrado ou inativo.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ========== 3. CRIAR USUÁRIO NO SUPABASE AUTH ==========
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailAdmin,
      password: senhaAdmin,
      email_confirm: true, // Auto-confirma para acesso imediato
      user_metadata: {
        full_name: nomeAdmin,
        role: 'admin_org'
      }
    });

    if (authError || !authData?.user) {
      console.error('Auth signup error:', authError);
      return new Response(
        JSON.stringify({ error: authError?.message || 'Erro ao criar conta de administrador.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id;

    // ========== 4. CRIAR ORGANIZAÇÃO ==========
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const slug = nomeEmpresa
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: nomeEmpresa,
        slug: slug,
        cnpj: cleanCnpj,
        logo_url: logoUrl || null,
        email_suporte: emailEmpresa,
        whatsapp_suporte: whatsappEmpresa || null,
        plano_id: plano.id,
        status_assinatura: 'ativa'
      })
      .select()
      .single();

    if (orgError || !orgData) {
      console.error('Org creation error:', orgError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: orgError?.message || 'Erro ao criar organização.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = orgData.id;

    // ========== 5. CRIAR ORGANIZATION_SETTINGS ==========
    const modulosAtivos = plano.recursos || {};

    const { error: settingsError } = await supabaseAdmin
      .from('organization_settings')
      .insert({
        organization_id: orgId,
        modulos_ativos: modulosAtivos
      });

    if (settingsError) {
      console.error('Settings creation error:', settingsError);
      // Não faz rollback completo para não perder a org já criada
    }

    // ========== 6. CRIAR PERFIL DO ADMIN EM public_users ==========
    // Gerar prefixo baseado no nome da empresa
    const words = nomeEmpresa.trim().split(/\s+/);
    let prefix = 'EMP';
    if (words.length >= 2) {
      prefix = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words[0].length >= 2) {
      prefix = words[0].substring(0, 2).toUpperCase();
    }
    prefix = prefix.replace(/[^A-Z]/g, '');
    if (prefix.length === 0) prefix = 'EMP';
    if (prefix.length > 3) prefix = prefix.substring(0, 3);
    
    const matriculaPrefix = `${prefix}-AD`;

    const { data: lastUser } = await supabaseAdmin
      .from('public_users')
      .select('matricula')
      .like('matricula', `${matriculaPrefix}%`)
      .order('matricula', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastUser && lastUser.length > 0 && lastUser[0].matricula) {
      const regex = new RegExp(`${matriculaPrefix}(\\d+)`);
      const match = lastUser[0].matricula.match(regex);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const matricula = `${matriculaPrefix}${String(nextNum).padStart(4, '0')}`;

    const { error: userError } = await supabaseAdmin
      .from('public_users')
      .upsert({
        id: userId,
        email: emailAdmin,
        full_name: nomeAdmin,
        cargo: 'Administrador',
        ativo: true,
        primeiro_acesso: false,
        matricula: matricula,
        is_vendedor: false,
        meta_mensal: 0,
        organization_id: orgId
      });

    if (userError) {
      console.error('User profile creation error:', userError);
    }

    // ========== 7. CRIAR CUSTOMER + ASSINATURA NO ASAAS ==========
    // 7a. Criar Customer
    const customerPayload = {
      name: nomeEmpresa,
      cpfCnpj: cleanCnpj,
      email: emailEmpresa,
      mobilePhone: whatsappEmpresa ? whatsappEmpresa.replace(/\D/g, '') : undefined,
    };

    const createCustomerRes = await fetch(`${asaasUrl}/customers`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(customerPayload)
    });

    if (!createCustomerRes.ok) {
      const errText = await createCustomerRes.text();
      console.error('Asaas customer creation failed:', errText);
      // Não fazemos rollback total — a org existe, o pagamento pode ser refeito depois
      return new Response(
        JSON.stringify({ 
          success: true, 
          orgId, 
          matricula,
          asaasError: true,
          message: 'Organização criada, mas houve erro ao processar pagamento. Tente novamente pela área de assinatura.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customerData = await createCustomerRes.json();
    const customerId = customerData.id;

    await supabaseAdmin
      .from('organizations')
      .update({ asaas_customer_id: customerId })
      .eq('id', orgId);

    // 7b. Criar Assinatura
    const date = new Date();
    date.setDate(date.getDate() + 15); // 15 dias grátis
    const brtDate = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const nextDueDate = brtDate.toISOString().split('T')[0];

    const subscriptionPayload: any = {
      customer: customerId,
      billingType: paymentMethod,
      value: plano.preco_mensal,
      nextDueDate: nextDueDate,
      cycle: 'MONTHLY',
      description: `Assinatura ${plano.nome} - ${nomeEmpresa}`,
      remoteIp: req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1',
    };

    if (paymentMethod === 'CREDIT_CARD' && cardDetails) {
      subscriptionPayload.creditCard = {
        holderName: cardDetails.holderName,
        number: cardDetails.number.replace(/\D/g, ''),
        expiryMonth: cardDetails.expiryMonth,
        expiryYear: cardDetails.expiryYear,
        ccv: cardDetails.ccv
      };
      subscriptionPayload.creditCardHolderInfo = {
        name: cardDetails.holderName,
        email: emailEmpresa,
        cpfCnpj: cleanCnpj,
        postalCode: cardDetails.postalCode?.replace(/\D/g, ''),
        addressNumber: cardDetails.addressNumber || '1',
        phone: whatsappEmpresa ? whatsappEmpresa.replace(/\D/g, '') : undefined,
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
        JSON.stringify({ 
          success: true, 
          orgId, 
          matricula,
          asaasError: true,
          message: 'Organização criada, mas houve erro ao criar assinatura. Tente pela área de configurações.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const subData = await createSubRes.json();
    const subscriptionId = subData.id;

    await supabaseAdmin
      .from('organizations')
      .update({
        asaas_subscription_id: subscriptionId,
        proxima_cobranca: nextDueDate
      })
      .eq('id', orgId);

    // ========== 8. BUSCAR DADOS DE PAGAMENTO ==========
    const paymentsResponse = await fetch(`${asaasUrl}/subscriptions/${subscriptionId}/payments?status=PENDING`, {
      method: 'GET',
      headers: asaasHeaders
    });

    let paymentInfo: any = {};

    if (paymentsResponse.ok) {
      const paymentsData = await paymentsResponse.json();
      if (paymentsData.data && paymentsData.data.length > 0) {
        const payment = paymentsData.data[0];
        paymentInfo = {
          paymentId: payment.id,
          billingType: payment.billingType,
          invoiceUrl: payment.invoiceUrl,
          bankSlipUrl: payment.bankSlipUrl,
          dueDate: payment.dueDate,
          value: payment.value
        };

        if (paymentMethod === 'PIX') {
          const pixResponse = await fetch(`${asaasUrl}/payments/${payment.id}/pixQrCode`, {
            method: 'GET',
            headers: asaasHeaders
          });

          if (pixResponse.ok) {
            const pixData = await pixResponse.json();
            paymentInfo.pixQrCode = pixData.encodedImage;
            paymentInfo.pixCopiaCola = pixData.payload;
          }
        }
      }
    }

    // ========== SUCESSO FINAL ==========
    return new Response(
      JSON.stringify({
        success: true,
        orgId,
        matricula,
        subscriptionId,
        message: 'Organização criada e assinatura processada com sucesso!',
        payment: paymentInfo
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in criar-organizacao:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
