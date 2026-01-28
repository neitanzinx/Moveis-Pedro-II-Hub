
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    console.log('--- Inspecting Vendas ---');
    // Fetch a few sales that are likely the problematic ones (e.g., older ones or specific IDs if known, here just ordering by date)
    const { data: vendas, error: errVendas } = await supabase
        .from('vendas')
        .select('*')
        .order('numero_pedido', { ascending: true })
    let output = '';

    if (errVendas) output += `Error fetching vendas: ${JSON.stringify(errVendas)}\n`;
    else output += `Vendas: ${JSON.stringify(vendas, null, 2)}\n`;

    output += '\n--- Inspecting Public Users ---\n';
    const { data: users, error: errUsers } = await supabase
        .from('public_users')
        .select('id, email, full_name, status_aprovacao');

    if (errUsers) output += `Error fetching users: ${JSON.stringify(errUsers)}\n`;
    else output += `Public Users: ${JSON.stringify(users, null, 2)}\n`;

    fs.writeFileSync('inspection_output.txt', output);
    console.log('Output written to inspection_output.txt');
}

inspectData();
