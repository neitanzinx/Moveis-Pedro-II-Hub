import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const { data: policies, error: polErr } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'clientes');
    
    console.log("=== POLICIES ON clientes ===");
    console.log("Error:", polErr);
    console.log("Data:", policies);

    const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql', { sql_query: `
        ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS all_clientes ON clientes;
        CREATE POLICY all_clientes ON clientes 
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
    `});
    console.log("=== SQL EXECUTION ===");
    console.log("Error:", sqlError);
    console.log("Data:", sqlData);
}
run();
