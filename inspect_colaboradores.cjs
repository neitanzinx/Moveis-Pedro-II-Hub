
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'robo-whatsapp-agendamentos', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing in robo-whatsapp-agendamentos/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectColaboradores() {
    console.log('Fetching recent collaborators...');
    const { data: colaboradores, error } = await supabase
        .from('colaboradores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching collaborators:', error);
        return;
    }

    console.log('Recent Collaborators:');
    if (colaboradores.length > 0) {
        console.log('Keys of first record:', Object.keys(colaboradores[0]));
    }
    colaboradores.forEach(c => {
        console.log(`- Nome: ${c.nome}`);
        console.log(`- Nome Completo: ${c.nome_completo}`);
        console.log(`  Cargo: '${c.cargo}'`);
        console.log(`  Ativo (bool): ${c.ativo}`);
        console.log(`  Status (str): '${c.status}'`);
        console.log(`  Created At: ${c.created_at}`);
        console.log('---');
    });
}

inspectColaboradores();
