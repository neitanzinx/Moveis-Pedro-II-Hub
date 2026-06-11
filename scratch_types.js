import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTypes() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status')
    .order('numero_pedido', { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(v => {
    console.log(`Pedido #${v.numero_pedido}:`);
    console.log(`  valor_total: value=${v.valor_total}, type=${typeof v.valor_total}`);
    console.log(`  desconto: value=${v.desconto}, type=${typeof v.desconto}`);
    console.log(`  valor_pago: value=${v.valor_pago}, type=${typeof v.valor_pago}`);
    console.log(`  valor_restante: value=${v.valor_restante}, type=${typeof v.valor_restante}`);
    if (v.pagamentos && v.pagamentos.length > 0) {
      console.log(`  pagamentos[0].valor: value=${v.pagamentos[0].valor}, type=${typeof v.pagamentos[0].valor}`);
    }
  });
}
checkTypes();
