import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test1_RpcSecurity() {
  console.log('\n--- TESTE 1: Segurança do RPC ---');
  // Criar um cliente autenticado com um email genérico/não operador para simular ataque
  // Como não temos a senha, podemos invocar o RPC usando apenas a key anônima (unauthenticated)
  // O esperado é falhar por causa da função public.is_saas_operator() que exige usuário operador
  console.log('Tentando chamar operator_override_subscription de forma anônima...');
  
  const { data, error } = await supabase.rpc('operator_override_subscription', {
    p_org_id: '00000000-0000-0000-0000-000000000000', // Um UUID fake para teste de permissionamento
    p_plano_id: '00000000-0000-0000-0000-000000000000',
    p_modulos: {},
    p_motivo: 'Teste Hack'
  });

  if (error) {
    console.log('✅ Bloqueado com sucesso! Erro recebido:', error.message);
  } else {
    console.log('❌ FALHA DE SEGURANÇA: A chamada não foi bloqueada. Retorno:', data);
  }
}

async function test2_EssencialPlanStatus() {
  console.log('\n--- TESTE 2: Impacto na Organização com Plano Essencial ---');
  // Buscar todas as organizações e confirmar que as que estão no Essencial mantiveram módulos
  const { data: essencialPlan, error: errPlan } = await supabase
    .from('planos')
    .select('id, ativo, slug')
    .eq('slug', 'essencial')
    .single();

  if (errPlan || !essencialPlan) {
    console.log('Plano essencial não encontrado para teste.');
    return;
  }

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select(`
      id, nome, plano_id, 
      organization_settings ( modulos_ativos )
    `)
    .eq('plano_id', essencialPlan.id);

  if (error) {
    console.log('Erro ao buscar organizações:', error.message);
    return;
  }

  if (!orgs || orgs.length === 0) {
    console.log('Nenhuma organização usando o plano essencial no momento para verificar.');
  } else {
    let success = true;
    for (let org of orgs) {
      const mods = org.organization_settings?.[0]?.modulos_ativos;
      if (!mods) {
        console.log(`❌ Organização ${org.nome} parece não ter modulos configurados.`);
        success = false;
      } else {
        console.log(`✅ Organização "${org.nome}" mantida com os modulos:`, mods);
      }
    }
    if (success) {
      console.log('✅ A desativação do plano não quebrou os recursos dos assinantes antigos.');
    }
  }
}

async function runTests() {
  console.log('Iniciando testes...');
  await test1_RpcSecurity();
  await test2_EssencialPlanStatus();
  console.log('\nTestes concluídos.');
}

runTests();
