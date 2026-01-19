// cron-montagens.js
// Cron job para enviar lembretes de montagem às 8h da manhã

const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://stgatkuwnouzwczkpphs.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2F0a3V3bm91endjemtwcGhzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY0MjcxMywiZXhwIjoyMDgxMjE4NzEzfQ.tCjXAoG5RgFukroLkKqp7zuBeZz2mqVhbX0I8W1pIjI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Enviar lembretes às 8h todos os dias
cron.schedule('0 8 * * *', async () => {
    console.log('⏰ [CRON] Verificando montagens do dia para enviar lembretes...');

    try {
        const hoje = new Date().toISOString().split('T')[0];

        // Buscar montagens do dia que ainda não receberam lembrete
        const { data: montagens, error } = await supabase
            .from('montagens_itens')
            .select('*')
            .eq('data_agendada', hoje)
            .eq('notificacao_lembrete_enviada', false)
            .in('status', ['agendada', 'confirmada']);

        if (error) {
            console.error('❌ Erro ao buscar montagens:', error);
            return;
        }

        console.log(`📋 Encontradas ${montagens?.length || 0} montagens para hoje`);

        for (const montagem of (montagens || [])) {
            if (!montagem.cliente_telefone) continue;

            try {
                // Enviar lembrete via API local
                const response = await fetch('http://localhost:3001/lembrete-montagem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        telefone: montagem.cliente_telefone,
                        nome: montagem.cliente_nome,
                        horario: montagem.horario_agendado
                    })
                });

                if (response.ok) {
                    // Marcar como enviado
                    await supabase
                        .from('montagens_itens')
                        .update({ notificacao_lembrete_enviada: true })
                        .eq('id', montagem.id);

                    console.log(`✅ Lembrete enviado para ${montagem.cliente_nome}`);
                }

                // Aguardar um pouco entre envios para não sobrecarregar
                await new Promise(r => setTimeout(r, 3000));

            } catch (e) {
                console.error(`❌ Erro ao enviar lembrete para ${montagem.cliente_nome}:`, e.message);
            }
        }

        console.log('✅ [CRON] Lembretes de montagem finalizados');

    } catch (error) {
        console.error('❌ Erro no cron de montagens:', error);
    }
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
});

console.log('📅 Cron de lembretes de montagem ativo (8h diariamente)');

module.exports = {};
