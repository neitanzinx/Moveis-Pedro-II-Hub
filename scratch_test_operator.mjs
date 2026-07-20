import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testOperatorQuery() {
    console.log("Testing saas_operator_users query...");
    const start = Date.now();
    const { data, error } = await supabase
        .from("saas_operator_users")
        .select("id, auth_user_id, email, is_active, last_login_at")
        .limit(1);
    const time = Date.now() - start;
    console.log(`Query took ${time}ms`);
    console.log("Data:", data);
    console.log("Error:", error);
}

testOperatorQuery();
