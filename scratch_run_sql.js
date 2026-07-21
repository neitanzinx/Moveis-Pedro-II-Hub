import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `
    SELECT tgname, tgtype, tgenabled, pg_get_triggerdef(oid) as def
    FROM pg_trigger 
    WHERE tgrelid = 'public.lancamentos_financeiros'::regclass;
  `;

  console.log("Running query via execute_raw_sql...");
  const { data, error } = await supabase.rpc('execute_raw_sql', { sql });
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
