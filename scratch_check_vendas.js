import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status, itens')
    .in('numero_pedido', ['10118', '10134']);

  if (error) {
    console.error('Error fetching sales:', error);
    return;
  }

  console.log('--- DETAILED SALES ---');
  data.forEach((v) => {
    console.log(`Pedido #${v.numero_pedido} (ID: ${v.id})`);
    console.log(`  Valor Total (DB): ${v.valor_total}`);
    console.log(`  Desconto (DB): ${v.desconto}`);
    console.log(`  Valor Pago (DB): ${v.valor_pago}`);
    console.log(`  Valor Restante (DB): ${v.valor_restante}`);
    const subtotal = v.itens?.reduce((sum, item) => sum + (item.subtotal || (item.quantidade * item.preco_unitario)), 0);
    console.log(`  Sum of Item Subtotals: ${subtotal}`);
    console.log(`  Calculated Expected Total (Subtotal - Desconto): ${subtotal - v.desconto}`);
    console.log(`  Itens:`, JSON.stringify(v.itens));
    console.log('----------------------------');
  });
}

checkVendas();
