import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getVendaFinanceiro } from './src/utils/vendaStatus.js';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCalculations() {
  const { data: vendas, error: salesError } = await supabase
    .from('vendas')
    .select('*')
    .in('numero_pedido', ['10118', '10134']);

  if (salesError) {
    console.error(salesError);
    return;
  }

  const { data: lancamentos, error: lancsError } = await supabase
    .from('lancamentos_financeiros')
    .select('*');

  const { data: entregas, error: delivsError } = await supabase
    .from('entregas')
    .select('*');

  vendas.forEach(v => {
    const fin = getVendaFinanceiro(v, { entregas, lancamentos });
    console.log(`Pedido #${v.numero_pedido}:`);
    console.log(`  venda.valor_total (DB): ${v.valor_total}`);
    console.log(`  venda.desconto (DB): ${v.desconto}`);
    console.log(`  venda.valor_pago (DB): ${v.valor_pago}`);
    console.log(`  venda.valor_restante (DB): ${v.valor_restante}`);
    console.log(`  financeiro.total (Calculated): ${fin.total}`);
    console.log(`  financeiro.valorPago (Calculated): ${fin.valorPago}`);
    console.log(`  financeiro.valorRestante (Calculated): ${fin.valorRestante}`);
    console.log(`  financeiro.isPaid (Calculated): ${fin.isPaid}`);
    console.log('------------------');
  });
}

checkCalculations();
