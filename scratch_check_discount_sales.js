import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDiscountSales() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status, itens')
    .gt('desconto', 0)
    .limit(100);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} sales with discount > 0.`);
  let matchingSubtotalCount = 0;
  data.forEach(v => {
    const subtotal = v.itens?.reduce((sum, item) => sum + (item.subtotal || (item.quantidade * item.preco_unitario || 0)), 0) || 0;
    const diffToSubtotal = Math.abs(v.valor_total - subtotal);
    if (diffToSubtotal < 0.05) {
      matchingSubtotalCount++;
      console.log(`Pedido #${v.numero_pedido}: valor_total matches subtotal!`);
      console.log(`  Subtotal: ${subtotal}`);
      console.log(`  Desconto: ${v.desconto}`);
      console.log(`  Valor Total (DB): ${v.valor_total}`);
      console.log(`  Valor Pago (DB): ${v.valor_pago}`);
      console.log(`  Valor Restante (DB): ${v.valor_restante}`);
      console.log('------------------');
    }
  });
  console.log(`Sales where valor_total matches subtotal: ${matchingSubtotalCount}`);
}
checkDiscountSales();
