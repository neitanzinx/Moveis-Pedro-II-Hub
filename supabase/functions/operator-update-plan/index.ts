import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function generateSlug(text: string) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-') + '-' + Date.now().toString(36);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Sem cabeçalho de autorização')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Validar se é operador
    const { data: isOperator, error: rpcError } = await supabaseClient.rpc('is_saas_operator')
    if (rpcError || !isOperator) {
      console.error("is_saas_operator erro:", rpcError)
      return new Response(JSON.stringify({ error: `Acesso negado. Apenas operadores podem gerenciar planos. Erro RPC: ${JSON.stringify(rpcError)}` }), {
        status: 200, // Retornar 200 para o client ler o JSON
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const action = payload.action || 'update'; // Default para manter compatibilidade
    
    if (action === 'delete') {
      const { planId } = payload;
      if (!planId) throw new Error('planId é obrigatório para deletar');

      const { error: deleteError } = await supabaseAdmin
        .from('planos')
        .delete()
        .eq('id', planId);

      if (deleteError) {
        if (deleteError.code === '23503') { // Foreign key violation
          throw new Error('Não é possível excluir este plano pois existem empresas ativas utilizando ele. Por favor, desative o plano em vez de excluí-lo.');
        }
        throw deleteError;
      }

      return new Response(JSON.stringify({ success: true, message: 'Plano excluído com sucesso.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create') {
      const { nome, preco_mensal, ativo, recursos } = payload;
      if (!nome || preco_mensal === undefined) throw new Error('Nome e preço são obrigatórios');

      const slug = generateSlug(nome);

      const { error: insertError } = await supabaseAdmin
        .from('planos')
        .insert([{
          nome,
          slug,
          preco_mensal,
          recursos: recursos || {},
          ativo: ativo !== undefined ? ativo : true
        }]);

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, message: 'Plano criado com sucesso.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const { planId, nome, preco_mensal, ativo, recursos, update_existing, update_existing_modules } = payload;

      if (!planId || !nome || preco_mensal === undefined) {
        throw new Error('Parâmetros inválidos');
      }

      // 1. Atualizar o plano no banco de dados
      const { error: updateError } = await supabaseAdmin
        .from('planos')
        .update({
          nome: nome,
          preco_mensal: preco_mensal,
          recursos: recursos || {},
          ativo: ativo !== undefined ? ativo : true
        })
        .eq('id', planId)

      if (updateError) throw updateError;

      // Buscar organizações afetadas (se precisar atualizar o asaas ou os módulos)
      let orgs = [];
      if (update_existing || update_existing_modules) {
        const { data: fetchedOrgs, error: orgsError } = await supabaseAdmin
          .from('organizations')
          .select('id, name, asaas_subscription_id')
          .eq('plano_id', planId);

        if (orgsError) throw orgsError;
        orgs = fetchedOrgs || [];
      }

      // 2. Atualizar módulos das empresas ativas (opcional)
      if (update_existing_modules && orgs.length > 0) {
        const orgIds = orgs.map(o => o.id);
        const { error: moduleUpdateError } = await supabaseAdmin
          .from('organization_settings')
          .update({
            modulos_ativos: recursos || {},
            updated_at: new Date().toISOString()
          })
          .in('organization_id', orgIds);

        if (moduleUpdateError) {
          console.error("Erro ao atualizar módulos das organizações:", moduleUpdateError);
        }
      }

      // 3. Atualizar assinaturas no Asaas (opcional)
      let asaasSuccessCount = 0;
      let asaasErrorCount = 0;

      if (update_existing && orgs.length > 0) {
        const asaasKey = Deno.env.get('ASAAS_API_KEY') || '';
        const defaultUrl = (asaasKey.trim().startsWith('$aae') || asaasKey.trim().startsWith('$aact_prod')) 
          ? 'https://api.asaas.com/v3' 
          : 'https://api-sandbox.asaas.com/v3';
        const asaasUrl = Deno.env.get('ASAAS_API_URL') || defaultUrl;

        if (!asaasKey) throw new Error("Chave do Asaas não configurada.");

        const asaasHeaders = {
          'Content-Type': 'application/json',
          'access_token': asaasKey
        };

        for (const org of orgs) {
          if (!org.asaas_subscription_id) continue;
          
          try {
            const res = await fetch(`${asaasUrl}/subscriptions/${org.asaas_subscription_id}`, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify({
                value: preco_mensal,
                updatePendingPayments: true
              })
            });

            if (!res.ok) {
              const errTxt = await res.text();
              console.error(`Erro Asaas para org ${org.name} (Sub ID: ${org.asaas_subscription_id}):`, errTxt);
              asaasErrorCount++;
            } else {
              asaasSuccessCount++;
            }
          } catch (e) {
            console.error(`Exceção ao atualizar Asaas org ${org.name}:`, e);
            asaasErrorCount++;
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Plano atualizado com sucesso.',
        asaas_stats: update_existing ? { success: asaasSuccessCount, errors: asaasErrorCount } : null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Ação inválida');
  } catch (error) {
    console.error("Error in operator-update-plan:", error);
    return new Response(JSON.stringify({ error: error.message || String(error) }), {
      status: 200, // Retornar 200 para o client ler o JSON sem estourar FunctionsHttpError vazio
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
