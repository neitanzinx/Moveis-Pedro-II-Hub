Ex
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCairo() {
    console.log("Searching for 'Cairo'...");

    // 1. Search by Name
    const { data: byName } = await supabase
        .from('produtos')
        .select('*')
        .ilike('nome', '%Cairo%');
    console.log(`Found ${byName?.length || 0} items by nome '%Cairo%'`);
    if (byName?.length) console.table(byName);

    // 2. Search by Model
    const { data: byModel } = await supabase
        .from('produtos')
        .select('*')
        .ilike('modelo_referencia', '%Cairo%');
    console.log(`Found ${byModel?.length || 0} items by model '%Cairo%'`);
    if (byModel?.length) console.table(byModel);

    // 3. Search by Supplier Name field matches
    const { data: bySupp } = await supabase
        .from('produtos')
        .select('*')
        .ilike('fornecedor_nome', '%Cairo%');
    console.log(`Found ${bySupp?.length || 0} items by fornecedor_nome '%Cairo%'`);
    if (bySupp?.length) console.table(bySupp);
}

inspectCairo();
