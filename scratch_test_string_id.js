import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // Insert row
  const { data: created, error: insErr } = await adminClient
    .from('lancamentos_financeiros')
    .insert({
      descricao: "TEST_STRING_ID",
      valor: 10.00,
      tipo: "Saída",
      data_vencimento: "2026-07-21",
      data_lancamento: "2026-07-21",
      organization_id: "00000000-0000-0000-0000-000000000001",
      status: "Pendente"
    })
    .select()
    .single();

  if (insErr) {
    console.error("Insert error:", insErr);
    return;
  }

  console.log("Created ID:", created.id, typeof created.id);

  // Try deleting using ID as a string
  const idStr = String(created.id);
  console.log("Attempting delete with ID as string:", idStr, typeof idStr);
  const { data, error } = await adminClient
    .from('lancamentos_financeiros')
    .delete()
    .eq('id', idStr)
    .select();

  console.log("Delete result:", { data, error });
}

run();
