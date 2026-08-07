import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    console.log("=== CHECKING cliente_sessoes_portal ===");
    const { data: sessoes, error: err1 } = await supabase.from('cliente_sessoes_portal').select('*').limit(10);
    console.log("Sessoes:", sessoes, "Error:", err1);

    console.log("=== CHECKING cliente_acesso_eventos ===");
    const { data: eventos, error: err2 } = await supabase.from('cliente_acesso_eventos').select('*').limit(10);
    console.log("Eventos:", eventos, "Error:", err2);

    console.log("=== CHECKING VIEW vw_cliente_acesso_indice_geral_diario ===");
    const { data: kpis, error: err3 } = await supabase.from('vw_cliente_acesso_indice_geral_diario').select('*').limit(10);
    console.log("KPIs view:", kpis, "Error:", err3);

    console.log("=== CHECKING VIEW vw_cliente_acesso_indice_individual ===");
    const { data: ind, error: err4 } = await supabase.from('vw_cliente_acesso_indice_individual').select('*').limit(10);
    console.log("Individual view:", ind, "Error:", err4);
}
run();
