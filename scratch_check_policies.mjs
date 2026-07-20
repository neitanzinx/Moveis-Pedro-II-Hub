import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;

async function checkPolicies() {
    if (!supabaseAdmin) {
        console.log("No service role key provided.");
        return;
    }

    const { data, error } = await supabaseAdmin.rpc('get_policies_for_table', { table_name: 'public_users' });
    if (error) {
         // Fallback to querying pg_policies if RPC doesn't exist
         const { data: qData, error: qError } = await supabaseAdmin.from('pg_policies').select('*').eq('tablename', 'public_users');
         console.log("Policies:", qData);
         console.log("Error:", qError);
    } else {
        console.log("Policies:", data);
    }
}

checkPolicies();
