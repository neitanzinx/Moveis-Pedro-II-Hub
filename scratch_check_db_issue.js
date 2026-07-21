import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  try {
    // 1. Get all policies on lancamentos_financeiros
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'lancamentos_financeiros');
    
    console.log("=== POLICIES ON lancamentos_financeiros ===");
    if (polErr) {
      console.error("Error fetching policies:", polErr);
    } else {
      console.log(policies);
    }

    // 2. Query some recent rows from lancamentos_financeiros
    const { data: rows, error: rowsErr } = await supabase
      .from('lancamentos_financeiros')
      .select('*')
      .limit(5);

    console.log("\n=== RECENT ROWS IN lancamentos_financeiros ===");
    if (rowsErr) {
      console.error("Error fetching rows:", rowsErr);
    } else {
      console.log(rows);
    }

    // 3. Check triggers
    const { data: triggers, error: trigErr } = await supabase
      .rpc('get_triggers', { t_name: 'lancamentos_financeiros' }); // if RPC doesn't exist, we will catch or it will error
    
    console.log("\n=== TRIGGERS ===");
    if (trigErr) {
      // Fallback query using SQL
      const { data: trigSql, error: trigSqlErr } = await supabase
        .rpc('execute_sql', { sql_query: `
          SELECT tgname, tgtype, tgenabled, tgenabled 
          FROM pg_trigger 
          WHERE tgrelid = 'public.lancamentos_financeiros'::regclass;
        ` });
      if (trigSqlErr) {
        console.error("SQL Fallback Error:", trigSqlErr);
        // Let's try raw query via another RPC if possible, or print error
      } else {
        console.log(trigSql);
      }
    } else {
      console.log(triggers);
    }

  } catch (err) {
    console.error("Exception:", err);
  }
}

run();
