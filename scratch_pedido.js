import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkPedido() {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('numero_pedido', '10109')
    .single();

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Pedido #${data.numero_pedido}:`);
  console.log(`  valor_total: ${data.valor_total}`);
  console.log(`  desconto: ${data.desconto}`);
  console.log(`  valor_pago: ${data.valor_pago}`);
  console.log(`  valor_restante: ${data.valor_restante}`);
  console.log(`  pagamentos:`, JSON.stringify(data.pagamentos));
  console.log(`  itens:`, JSON.stringify(data.itens));
}
checkPedido();
