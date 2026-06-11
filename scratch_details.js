import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDetails() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status, itens')
    .in('numero_pedido', ['10109', '10115', '10121', '10134', '10118']);

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(v => {
    console.log(`Pedido #${v.numero_pedido}:`);
    console.log(`  valor_total: ${v.valor_total}`);
    console.log(`  desconto: ${v.desconto}`);
    console.log(`  valor_pago: ${v.valor_pago}`);
    console.log(`  valor_restante: ${v.valor_restante}`);
    console.log(`  pagamentos:`, JSON.stringify(v.pagamentos));
    console.log('------------------');
  });
}
checkDetails();
