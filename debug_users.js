
require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Fallback manual se as variaveis nao forem carregadas corretamente do .env (ajuste conforme necessario ou use .env.local)
// Mas vamos tentar ler o arquivo .env diretamente se falhar o process.env
const fs = require('fs');
const path = require('path');

let url = supabaseUrl;
let key = supabaseKey;

if (!url || !key) {
    try {
        const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        const lines = envContent.split('\n');
        for (const line of lines) {
            if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
            if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
        }
    } catch (e) {
        console.error("Erro ao ler .env manualmente:", e);
    }
}

if (!url || !key) {
    console.error("Faltando credenciais do Supabase");
    process.exit(1);
}

const supabase = createClient(url, key);

async function checkUsers() {
    console.log("Consultando ultimos usuarios cadastrados...");

    // Buscar ultimos 5 usuarios criados/atualizados
    const { data, error } = await supabase
        .from('public_users')
        .select('id, full_name, email, cargo, matricula, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Erro:", error);
    } else {
        console.log("Usuarios encontrados:");
        console.table(data);
    }
}

checkUsers();
