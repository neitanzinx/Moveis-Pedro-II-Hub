
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase
        .from('entregas')
        .select('id, cliente_nome, preferencias_entrega, data_restricao, motivo_restricao')
        .ilike('cliente_nome', '%NATAN RIZZO%')
        .limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Delivery Data:", JSON.stringify(data, null, 2));
}

checkData();
