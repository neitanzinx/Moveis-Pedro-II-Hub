import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ";

const adminClient = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
  try {
    // 1. Create a dummy lancamento using adminClient
    const testData = {
      descricao: "TEST_DELETE_TEMP",
      valor: 99.99,
      tipo: "Saída",
      data_vencimento: "2026-07-21",
      data_lancamento: "2026-07-21",
      organization_id: "00000000-0000-0000-0000-000000000001",
      status: "Pendente"
    };

    console.log("Inserting test row...");
    const { data: created, error: insErr } = await adminClient
      .from('lancamentos_financeiros')
      .insert(testData)
      .select()
      .single();

    if (insErr) {
      console.error("Error inserting test row:", insErr);
      return;
    }

    console.log("Inserted row ID:", created.id);

    // 2. Now let's try to delete it using the anonClient (simulating the web app without login)
    console.log("\nAttempting delete using anonymous client...");
    const { data: delAnonData, error: delAnonErr } = await anonClient
      .from('lancamentos_financeiros')
      .delete()
      .eq('id', created.id)
      .select(); // using select() to see what it returned

    console.log("Anon delete response:", { data: delAnonData, error: delAnonErr });

    // 3. Now let's try to delete it using the adminClient (with service role)
    console.log("\nAttempting delete using admin client...");
    const { data: delAdminData, error: delAdminErr } = await adminClient
      .from('lancamentos_financeiros')
      .delete()
      .eq('id', created.id)
      .select();

    console.log("Admin delete response:", { data: delAdminData, error: delAdminErr });

  } catch (err) {
    console.error("Exception:", err);
  }
}

run();
