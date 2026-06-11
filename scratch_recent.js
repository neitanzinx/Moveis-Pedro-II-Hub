import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRecentVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select('id, numero_pedido, valor_total, desconto, valor_pago, valor_restante, pagamentos, status, itens')
    .order('numero_pedido', { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);
    return;
  }

  console.log('pedido | subtotal | desconto | total_db | pago_db | restante_db | status');
  data.forEach(v => {
    const subtotal = v.itens?.reduce((sum, item) => sum + (item.subtotal || (item.quantidade * item.preco_unitario || 0)), 0) || 0;
    console.log(`${v.numero_pedido} | ${subtotal} | ${v.desconto || 0} | ${v.valor_total} | ${v.valor_pago || 0} | ${v.valor_restante || 0} | ${v.status}`);
  });
}
checkRecentVendas();
