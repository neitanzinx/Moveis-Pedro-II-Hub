import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Variáveis de ambiente não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Consultando planos...");
  try {
    const { data: planos, error: pError } = await supabase.from('planos').select('id, nome').limit(2);
    if (pError) console.error("Erro planos:", pError);
    else console.log("Planos:", planos);

    console.log("Consultando saas_operator_users...");
    const { data: ops, error: oError } = await supabase.from('saas_operator_users').select('id, email').limit(2);
    if (oError) console.error("Erro ops:", oError);
    else console.log("Ops:", ops);
    
    console.log("Fim!");
  } catch (err) {
    console.error("Exceção:", err);
  }
}

check();
