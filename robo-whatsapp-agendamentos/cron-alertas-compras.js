const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente do diretório pai (se necessário) ou do local
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: SUPABASE_URL ou SUPABASE_KEY não configurados.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Função principal de processamento de alertas
 */
async function processarAlertasCompras() {
    console.log(`[${new Date().toISOString()}] Iniciando processamento de alertas de compras...`);

    try {
        const hoje = new Date();

        // 1. Alerta: SEM RESPOSTA FORNECEDOR (> 24h)
        // Condição: status aprovado, sem devolutiva, horas > 24
        const vinteEQuatroHorasAtras = new Date(hoje.getTime() - (24 * 60 * 60 * 1000)).toISOString();

        const { data: ocsSemResposta, error: err1 } = await supabase
            .from('compras_ordens')
            .select('*, centro_custo:centro_custo_id(nome)')
            .eq('status', 'APROVADO')
            .is('devolutiva', null)
            .lt('updated_at', vinteEQuatroHorasAtras)
            .is('deleted_at', null);

        if (err1) throw err1;

        for (const oc of (ocsSemResposta || [])) {
            console.log(`Alertando OC ${oc.numero_pedido}: Fornecedor não respondeu há 24h`);
            await registrarNotificacaoInterna(oc, 'Fornecedor não respondeu há 24h');
            // Aqui poderíamos chamar uma API de WhatsApp se tivéssemos o telefone do comprador
        }

        // 2. Alerta: ENTREGA ATRASADA
        // Condição: entregas com data prevista < hoje e status não recebido/cancelado
        const hojeString = hoje.toISOString().split('T')[0];
        const { data: ocsAtrasadas, error: err2 } = await supabase
            .from('compras_ordens')
            .select('*, centro_custo:centro_custo_id(nome)')
            .not('status', 'in', '("Recebido","Cancelado","ENTREGUE")')
            .lt('data_previsao_entrega', hojeString)
            .is('deleted_at', null);

        if (err2) throw err2;

        for (const oc of (ocsAtrasadas || [])) {
            console.log(`OC ${oc.numero_pedido} ATRASADA. Atualizando status...`);
            // Atualizar status para refletir atraso (opcional, dependendo se queremos mudar o status literal)
            // if (oc.status !== 'ATRASADO') {
            //     await supabase.from('compras_ordens').update({ status: 'ATRASADO' }).eq('id', oc.id);
            // }
            await registrarNotificacaoInterna(oc, 'Entrega atrasada! Verifique com o fornecedor.');
        }

        // 3. Alerta: APROVAÇÃO PENDENTE (> 4h)
        // Condição: status NÃO FATURADO e criado há mais de 4h
        const quatroHorasAtras = new Date(hoje.getTime() - (4 * 60 * 60 * 1000)).toISOString();
        const { data: ocsPendentesAprovacao, error: err3 } = await supabase
            .from('compras_ordens')
            .select('*, centro_custo:centro_custo_id(nome)')
            .eq('status', 'NÃO FATURADO')
            .lt('created_at', quatroHorasAtras)
            .is('deleted_at', null);

        if (err3) throw err3;

        for (const oc of (ocsPendentesAprovacao || [])) {
            console.log(`OC ${oc.numero_pedido} aguardando aprovação há mais de 4h.`);
            await registrarNotificacaoInterna(oc, 'Aprovação pendente há mais de 4h. Escalar se necessário.');
        }

        console.log(`[${new Date().toISOString()}] Fim do processamento.`);
    } catch (error) {
        console.error('Erro ao processar alertas:', error);
    }
}

/**
 * Registra uma comunicação interna na timeline da OC
 */
async function registrarNotificacaoInterna(oc, mensagem) {
    try {
        await supabase.from('compras_comunicacoes').insert({
            ordem_compra_id: oc.id,
            tipo: 'nota_interna',
            remetente: 'Sistema de Alertas',
            conteudo: { texto: mensagem },
            data_envio: new Date().toISOString()
        });
    } catch (e) {
        console.error('Erro ao registrar nota interna:', e);
    }
}

// Executar se for chamado diretamente
if (require.main === module) {
    processarAlertasCompras();
}

module.exports = { processarAlertasCompras };
