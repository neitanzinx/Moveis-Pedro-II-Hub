import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase.from('pedidos_compra').select('*').limit(1);
    if (error) {
        console.error("Error fetching pedidos_compra:", error);
    } else {
        console.log("pedidos_compra columns:", data.length > 0 ? Object.keys(data[0]) : "No data to infer columns");

        // Fallback: try to insert a fake record to see what errors out
        const { error: insError } = await supabase.from('pedidos_compra').insert({
            fornecedor_id: 'fake',
            fake_column_: 1
        });
        console.log("Insert response:", insError);
    }
}
checkSchema();
