// Diagnóstico: verifica estado dos produtos e fornecedores no banco
// Uso: node scripts/diagnostico_fornecedores.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://stgatkuwnouzwczkpphs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('\n=== DIAGNÓSTICO FORNECEDORES/PRODUTOS ===\n');

  // 1. Listar todos os fornecedores
  const { data: fornecedores, error: fe } = await supabase
    .from('fornecedores')
    .select('id, nome_empresa')
    .order('nome_empresa');

  if (fe) {
    console.error('ERRO ao buscar fornecedores:', fe.message, '(code:', fe.code, ')');
    console.log('→ Possível causa: RLS bloqueando sem autenticação.');
  } else {
    console.log(`Fornecedores encontrados: ${fornecedores?.length ?? 0}`);
    (fornecedores || []).forEach(f => console.log(`  [${f.id}] ${f.nome_empresa}`));
  }

  // 2. Amostra de produtos com colunas de fornecedor
  const { data: produtos, error: pe } = await supabase
    .from('produtos')
    .select('id, nome, fornecedor_id, fornecedor_nome')
    .order('nome')
    .limit(30);

  if (pe) {
    console.error('\nERRO ao buscar produtos:', pe.message, '(code:', pe.code, ')');
  } else {
    console.log(`\nAmostra de produtos (${produtos?.length ?? 0} primeiros):`);
    (produtos || []).forEach(p => {
      console.log(`  [${p.id}] ${p.nome}`);
      console.log(`         fornecedor_id="${p.fornecedor_id}" | fornecedor_nome="${p.fornecedor_nome}"`);
    });

    // 3. Estatísticas
    const semId = (produtos || []).filter(p => !p.fornecedor_id);
    const semNome = (produtos || []).filter(p => !p.fornecedor_nome);
    const ambos = (produtos || []).filter(p => p.fornecedor_id && p.fornecedor_nome);
    const nenhum = (produtos || []).filter(p => !p.fornecedor_id && !p.fornecedor_nome);
    console.log('\nResumo (na amostra):');
    console.log(`  Só fornecedor_nome (sem id): ${semId.length}`);
    console.log(`  Só fornecedor_id (sem nome): ${semNome.length}`);
    console.log(`  Ambos (id + nome): ${ambos.length}`);
    console.log(`  Nenhum: ${nenhum.length}`);
  }

  // 4. Verificar se os fornecedor_ids dos produtos batem com fornecedores existentes
  if (fornecedores && produtos) {
    const idSet = new Set((fornecedores || []).map(f => f.id));
    const produtosComIdOrfao = (produtos || []).filter(p => p.fornecedor_id && !idSet.has(p.fornecedor_id));
    if (produtosComIdOrfao.length > 0) {
      console.log(`\n⚠ Produtos com fornecedor_id sem correspondência na tabela fornecedores: ${produtosComIdOrfao.length}`);
      produtosComIdOrfao.forEach(p => console.log(`  [${p.id}] ${p.nome} → fornecedor_id=${p.fornecedor_id}`));
    } else {
      console.log('\n✓ Todos os fornecedor_ids encontrados batem com fornecedores existentes.');
    }
  }
}

run().catch(console.error);
