import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    console.log("Testing with anon key...");
    const { data, error } = await supabase
        .from('public_users')
        .select('*')
        .eq('ativo', true)
        .limit(5);
    
    console.log("Anon Query Data:", data);
    console.log("Anon Query Error:", error);

    // Let's also test with service role if we have it, to see if it's RLS
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log("\nTesting with service role key...");
        const { data: adminData, error: adminError } = await supabaseAdmin
            .from('public_users')
            .select('*')
            .eq('ativo', true)
            .limit(5);
        
        console.log("Admin Query Data:", adminData?.length, "users found.");
        console.log("Admin Query Error:", adminError);
    }
}

testLogin();
