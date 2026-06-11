import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRestanteDiscrepancies() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status, itens')
    .order('numero_pedido', { ascending: false })
    .limit(1000);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Restante discrepancies:');
  let count = 0;
  data.forEach(v => {
    const subtotal = v.itens?.reduce((sum, item) => sum + (item.subtotal || (item.quantidade * item.preco_unitario || 0)), 0) || 0;
    const expectedRestante = Math.max(0, v.valor_total - (v.valor_pago || 0));
    
    // If there is a discount and valor_restante is NOT matching expectedRestante
    const diff = Math.abs(v.valor_restante - expectedRestante);
    if (diff > 0.05) {
      count++;
      console.log(`Pedido #${v.numero_pedido}:`);
      console.log(`  Subtotal: ${subtotal}`);
      console.log(`  Desconto: ${v.desconto}`);
      console.log(`  Valor Total (DB): ${v.valor_total}`);
      console.log(`  Valor Pago (DB): ${v.valor_pago}`);
      console.log(`  Valor Restante (DB): ${v.valor_restante} (Expected: ${expectedRestante})`);
      console.log('------------------');
    }
  });
  console.log(`Total discrepancies: ${count}`);
}
checkRestanteDiscrepancies();
