
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearDatabase() {
    console.log('--- Iniciando limpeza profunda (v2) ---');

    const tablesToClear = [
        'montagens',
        'entregas',
        'devolucoes',
        'vendas',
        'orcamentos',
        'transferencias_estoque',
        'alertas_recompra',
        'historico_precos',
        'produtos'
    ];

    for (const table of tablesToClear) {
        process.stdout.write(`Limpando ${table}... `);
        try {
            // .filter('id', 'neq', ...) can fail if type mismatch.
            // .delete().not('id', 'is', null) is more universal for both UUID and BIGINT
            const { error } = await supabase.from(table).delete().not('id', 'is', null);

            if (error) {
                // Se falhar por 'id' ser null ou algo assim, tentamos outro fallback
                const { error: error2 } = await supabase.from(table).delete().limit(100000).neq('created_at', '1900-01-01');
                if (error2) {
                    console.log(`ERRO: ${error2.message}`);
                } else {
                    console.log('OK (via fallback)');
                }
            } else {
                console.log('OK');
            }
        } catch (e) {
            console.log('FALHA CRÍTICA (ignorando)');
        }
    }

    console.log('\n--- PROCESSO CONCLUÍDO ---');
}

clearDatabase();
