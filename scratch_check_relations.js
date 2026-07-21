import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: vendas, error: e1 } = await supabase
    .from('lancamentos_financeiros')
    .select('id, descricao, venda_id, devolucao_id, origem_tipo, origem_id')
    .not('venda_id', 'is', null)
    .limit(5);

  const { data: devolucoes, error: e2 } = await supabase
    .from('lancamentos_financeiros')
    .select('id, descricao, venda_id, devolucao_id, origem_tipo, origem_id')
    .not('devolucao_id', 'is', null)
    .limit(5);

  const { data: origens, error: e3 } = await supabase
    .from('lancamentos_financeiros')
    .select('id, descricao, venda_id, devolucao_id, origem_tipo, origem_id')
    .not('origem_id', 'is', null)
    .limit(5);

  console.log("=== Venda IDs ===");
  console.log(vendas);

  console.log("=== Devolucao IDs ===");
  console.log(devolucoes);

  console.log("=== Origem IDs ===");
  console.log(origens);
}

run();
