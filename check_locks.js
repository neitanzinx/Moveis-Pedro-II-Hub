import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Variáveis de ambiente não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLocks() {
  console.log("Checking active queries and locks...");
  const { data, error } = await supabase.rpc('is_saas_operator'); // Try executing the RPC
  console.log("RPC result:", data, error);

  // If there's a lock, maybe we can see it via a view if we had one.
  // We can just try to update a row in organizations to see if it hangs
  const { data: org, error: orgErr } = await supabase.from('organizations').select('id').limit(1);
  if (org && org.length > 0) {
      console.log("Selected org instantly");
  } else {
      console.log("Failed to select org", orgErr);
  }
}

checkLocks();
