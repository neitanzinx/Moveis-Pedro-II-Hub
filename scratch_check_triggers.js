import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('inspect_triggers');
  
  if (error) {
    // If RPC doesn't exist, query pg_trigger directly via SQL or try another way
    console.log('inspect_triggers RPC failed, trying raw query via a temporary function...');
    // We don't have raw SQL execution directly unless we create/call an RPC. Let's try executing standard select or check schema.
    console.error(error);
    return;
  }
  console.log('Triggers:', data);
}

checkTriggers();
