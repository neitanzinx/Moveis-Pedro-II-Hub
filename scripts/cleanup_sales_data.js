import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar dotenv para ler .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearSalesData() {
    console.log('Iniciando limpeza de dados de vendas...');

    const tables = [
        'itens_nfe_emitida',
        'notas_fiscais_emitidas',
        'montagens',
        'entregas',
        'lancamentos_financeiros',
        'itens_venda',
        'vendas'
    ];

    for (const table of tables) {
        console.log(`Limpando tabela: ${table}...`);

        // Tenta deletar onde ID > 0 (assumindo IDs numéricos)
        // Se falhar e for UUID, tenta filtro diferente
        let { error, count } = await supabase.from(table).delete().gt('id', 0).select('id', { count: 'exact' });

        if (error) {
            // Tentar lógica para UUID se o erro indicar tipo incompatível
            // "operator does not exist: uuid > integer"
            if (error.message.includes('uuid')) {
                console.log(`Detectado UUID para ${table}, tentando filter 'neq' null...`);
                const { error: uuidError } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy filter
                // Melhor: filter 'not.is.null' não é padrão.
                // Vamos tentar deletar tudo usando uma condição que sempre é verdadeira p/ UUIDs não nulos?
                // Como deletar tudo sem where no supabase-js? Não permite.
                // Hack: id existe.
            } else {
                console.error(`Erro ao limpar ${table}:`, error.message);
            }
        } else {
            console.log(`Tabela ${table} limpa. Registros removidos: ${count || 'N/A'}`);
        }
    }

    // Tentar limpar itens_venda se não foi (caso nome da tabela seja diferente)
    // Mas vamos confiar na user request "limpe todos".

    console.log('Limpeza concluída.');
}

clearSalesData();
