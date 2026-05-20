// Script para limpar a tabela de produtos e suas dependências no banco Supabase (Service Role)
// Uso: node scripts/limpar_produtos.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://stgatkuwnouzwczkpphs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanAll() {
  console.log('\n=== LIMPEZA DO BANCO DE DADOS DE PRODUTOS E DEPENDÊNCICIAS ===\n');

  // Lista de tabelas na ordem de dependência (filhas primeiro, depois pais)
  const tablesToClean = [
    'compras_recebimentos_historico',
    'compras_oc_itens',
    'compras_contas_pagar',
    'compras_ordens',
    'solicitacoes_encomenda',
    'solicitacoes_reposicao',
    'solicitacoes_preco',
    'historico_precos',
    'promocoes_fornecedor',
    'solicitacoes_cadastro_produto',
    'movimentacoes_estoque',
    'alertas_recompra',
    'transferencias_estoque',
    'itens_pedido_compra',
    'pedidos_compra',
    'itens_nota_fiscal',
    'itens_nfe_emitida',
    'produtos'
  ];

  for (const table of tablesToClean) {
    console.log(`Limpando tabela: ${table}...`);
    
    // Tenta deletar todos os registros onde id não é nulo
    const { error, count } = await supabase
      .from(table)
      .delete()
      .not('id', 'is', null)
      .select('id', { count: 'exact' });

    if (error) {
      // Se der erro porque a coluna 'id' não existe na tabela, tenta sem filtro ou com outro campo comum
      if (error.message.includes("column id does not exist") || error.message.includes("id")) {
        console.log(`  Coluna 'id' não encontrada em ${table}, tentando deletar sem filtro...`);
        // No supabase-js v2, para deletar todas as linhas sem filtro, precisamos de um filtro sempre verdadeiro
        // Vamos tentar com outro nome de PK comum se soubermos, ou com um filtro genérico
        const { error: err2, count: c2 } = await supabase
          .from(table)
          .delete()
          .neq('created_at', '1970-01-01')
          .select('*, count:exact');
          
        if (err2) {
          console.error(`  ❌ Erro ao limpar ${table}:`, err2.message);
        } else {
          console.log(`  ✓ ${table} limpa. Registros removidos: ${c2 || 0}`);
        }
      } else {
        console.error(`  ❌ Erro ao limpar ${table}:`, error.message);
      }
    } else {
      console.log(`  ✓ ${table} limpa. Registros removidos: ${count || 0}`);
    }
  }

  console.log('\n=== VERIFICAÇÃO FINAL ===');
  const { count: prodCount, error: errProd } = await supabase
    .from('produtos')
    .select('*', { count: 'exact', head: true });

  if (errProd) {
    console.error('❌ Erro ao verificar produtos:', errProd.message);
  } else {
    console.log(`Total de produtos restantes no banco: ${prodCount}`);
    if (prodCount === 0) {
      console.log('🎉 Banco de dados de produtos limpo com sucesso! Pronto para reimportação do CSV.');
    } else {
      console.log('⚠ Ainda restam produtos no banco. Verifique os erros acima.');
    }
  }
}

cleanAll().catch(console.error);
