import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: cols, error: colsErr } = await supabase.rpc('execute_sql', { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs'" });
    console.log(cols, colsErr);
    
    // Fallback: let's insert and select
    const { data: inserted, error: insertErr } = await supabase.from('audit_logs').insert({ table_name: 'test', action: 'TEST' }).select();
    console.log("Insert result:", inserted, insertErr);
}

check();
