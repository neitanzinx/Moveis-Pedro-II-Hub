import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const columnsMap = {
  compras_ordens: [
    'id', 'numero_pedido', 'fornecedor_id', 'fornecedor_nome', 'centro_custo_id',
    'data_previsao_entrega', 'observacoes', 'valor_total', 'status', 'approval_status',
    'forma_pagamento_oc', 'pagamento_status', 'observacoes_aprovacao', 'anexos_aprovacao',
    'anexo_fornecedor', 'anexos_financeiro', 'metadata', 'data_pedido', 'approved_by',
    'approval_date', 'approval_comments', 'prazo_pagamento', 'deleted_at', 'updated_at',
    'pagamento_aprovado_por', 'pagamento_aprovado_em', 'pagamento_forma_final',
    'pagamento_formas_multiplas', 'pagamento_parcelas', 'pagamento_valor_pago',
    'pagamento_data_pagamento', 'pagamento_observacoes', 'responsavel_id', 'tenant_id'
  ],
  compras_oc_itens: [
    'id', 'ordem_compra_id', 'produto_id', 'produto_nome', 'nome_completo_produto',
    'cor_item', 'descricao_personalizada', 'tipo_item_oc', 'origem_solicitacao',
    'pedido_origem_numero', 'reposicao_fabrica', 'motivo_assistencia',
    'possui_imagens_videos', 'anexos_item', 'quantidade_pedida', 'preco_custo_item',
    'markup_multiplicador', 'markup_percentual', 'preco_final_sugerido',
    'preco_final_manual', 'preco_unitario', 'preco_tabela', 'quantidade_recebida',
    'status_recebimento', 'created_at', 'updated_at', 'deleted_at'
  ],
  compras_recebimentos_historico: [
    'id', 'tenant_id', 'ordem_compra_id', 'numero_oc', 'numero_nfe', 'observacoes',
    'recebido_por', 'created_at', 'updated_at'
  ],
  compras_recebimentos_itens: [
    'id', 'recebimento_id', 'oc_item_id', 'quantidade_recebida', 'preco_unitario',
    'observacao_item', 'created_at', 'updated_at'
  ],
  solicitacoes_encomenda: [
    'id', 'ordem_id', 'status', 'observacoes'
  ]
};

async function testTableColumns() {
  for (const [table, columns] of Object.entries(columnsMap)) {
    console.log(`\n--- Testing columns for table: ${table} ---`);
    const missingColumns = [];
    const existingColumns = [];

    // Test columns one by one
    for (const col of columns) {
      const { error } = await supabase
        .from(table)
        .select(col)
        .limit(1);

      if (error) {
        if (error.message.includes('Could not find the') || error.message.includes('column') || error.message.includes('not exist')) {
          console.log(`❌ Missing Column: ${col} (${error.message})`);
          missingColumns.push(col);
        } else {
          console.log(`⚠️ Unexpected error on column ${col}:`, error.message);
        }
      } else {
        existingColumns.push(col);
      }
    }

    console.log(`Summary for ${table}:`);
    console.log(`  Total Columns Tested: ${columns.length}`);
    console.log(`  Existing Columns: ${existingColumns.length}`);
    console.log(`  Missing Columns: ${missingColumns.length}`);
    if (missingColumns.length > 0) {
      console.log(`  ❌ MISSING: ${missingColumns.join(', ')}`);
    } else {
      console.log(`  ✅ All tested columns exist!`);
    }
  }
}

testTableColumns();
