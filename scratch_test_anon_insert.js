import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://stgatkuwnouzwczkpphs.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDI3MTMsImV4cCI6MjA4MTIxODcxM30.2_zKnRPDPYrztbUT2PyQ90WLSjm3eyvp2z_BGJAeAmQ";

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
    console.log("=== TRYING INSERT WITH ANON CLIENT (without auth) ===");
    const { data: sData, error: sErr } = await supabase.from('cliente_sessoes_portal').insert({
        auth_user_id: '00000000-0000-0000-0000-000000000000',
        session_token: 'test-token',
        started_from: '/area-cliente'
    }).select();
    console.log("Anon Session Insert:", sData, "Error:", sErr);

    const { data: eData, error: eErr } = await supabase.from('cliente_acesso_eventos').insert({
        sessao_id: 1,
        auth_user_id: '00000000-0000-0000-0000-000000000000',
        event_name: 'test_event',
        event_category: 'test'
    }).select();
    console.log("Anon Event Insert:", eData, "Error:", eErr);
}
run();
