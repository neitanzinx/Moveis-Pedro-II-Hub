import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ";

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

async function run() {
  let testUser = null;
  let testRow = null;

  try {
    const testEmail = `test_delete_${Date.now()}@example.com`;
    const testPassword = "Password123!";

    console.log(`Creating auth user: ${testEmail}...`);
    const { data: userData, error: createErr } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (createErr) {
      console.error("Error creating auth user:", createErr);
      return;
    }

    testUser = userData.user;
    console.log("Auth user created ID:", testUser.id);

    console.log("Updating public_users profile organization...");
    const { error: profileErr } = await adminClient
      .from('public_users')
      .update({
        organization_id: "00000000-0000-0000-0000-000000000001",
        ativo: true
      })
      .eq('id', testUser.id);

    if (profileErr) {
      console.error("Error updating profile:", profileErr);
      return;
    }

    console.log("Logging in with test user...");
    const { data: sessionData, error: loginErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr) {
      console.error("Error logging in:", loginErr);
      return;
    }

    console.log("Logged in successfully. Session JWT token acquired.");

    // Insert a financial row belonging to the same organization
    console.log("Inserting test lancamento...");
    const { data: rowData, error: rowErr } = await adminClient
      .from('lancamentos_financeiros')
      .insert({
        descricao: "TEST_DELETE_USER",
        valor: 123.45,
        tipo: "Saída",
        data_vencimento: "2026-07-21",
        data_lancamento: "2026-07-21",
        organization_id: "00000000-0000-0000-0000-000000000001",
        status: "Pendente"
      })
      .select()
      .single();

    if (rowErr) {
      console.error("Error inserting lancamento:", rowErr);
      return;
    }

    testRow = rowData;
    console.log("Inserted lancamento ID:", testRow.id);

    // Try deleting using userClient (with RLS check)
    console.log("\nAttempting delete using authenticated user client...");
    const { data: delData, error: delErr } = await userClient
      .from('lancamentos_financeiros')
      .delete()
      .eq('id', testRow.id)
      .select();

    console.log("Authenticated delete response:", { data: delData, error: delErr });

  } catch (err) {
    console.error("Exception:", err);
  } finally {
    // Cleanup
    console.log("\nCleaning up...");
    if (testRow) {
      const { data, error } = await adminClient
        .from('lancamentos_financeiros')
        .delete()
        .eq('id', testRow.id);
      console.log("Cleanup row result:", { data, error });
    }
    if (testUser) {
      // In this system, deleteUser on auth might automatically delete the profile in public_users.
      // Let's delete user from auth directly.
      const { error: authDelErr } = await adminClient.auth.admin.deleteUser(testUser.id);
      console.log("Cleanup auth user result:", { error: authDelErr });
    }
  }
}

run();
