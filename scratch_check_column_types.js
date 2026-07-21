import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: vRow } = await supabase.from('vendas').select('*').limit(1);
  const { data: lfRow } = await supabase.from('lancamentos_financeiros').select('*').limit(1);

  console.log("=== Vendas sample ===");
  console.log(vRow);

  console.log("=== Lancamentos sample ===");
  console.log(lfRow);
}

run();
