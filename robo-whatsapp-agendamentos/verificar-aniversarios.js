require("dotenv").config();
const { createClient } = require('@supabase/supabase-js');

// Configuração Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Busca clientes que fazem aniversário hoje
 */
async function buscarAniversariantesHoje() {
    const hoje = new Date();
    const dia = hoje.getDate();
    const mes = hoje.getMonth() + 1;

    console.log(`🎂 Buscando aniversariantes do dia ${dia}/${mes}...`);

    try {
        // Busca todos os clientes com data_nascimento preenchida
        const { data: clientes, error } = await supabase
            .from('clientes')
            .select('*')
            .not('data_nascimento', 'is', null)
            .not('telefone', 'is', null);

        if (error) throw error;

        // Filtra localmente por dia e mês
        const aniversariantes = clientes.filter(cliente => {
            if (!cliente.data_nascimento) return false;
            const [, mes_nasc, dia_nasc] = cliente.data_nascimento.split('-').map(Number);
            return dia_nasc === dia && mes_nasc === mes;
        });

        console.log(`✅ Encontrados ${aniversariantes.length} aniversariantes`);
        return aniversariantes;

    } catch (error) {
        console.error('❌ Erro ao buscar aniversariantes:', error);
        return [];
    }
}

/**
 * Cria cupom personalizado para o cliente
 */
async function criarCupomAniversario(cliente) {
    try {
        // Gera código: Primeiro nome + 10
        const primeiroNome = cliente.nome_completo.split(' ')[0].toUpperCase();
        const codigoCupom = `${primeiroNome}10`;

        // Verifica se cupom já existe
        const { data: existente } = await supabase
            .from('cupons')
            .select('id')
            .eq('codigo', codigoCupom)
            .single();

        if (existente) {
            console.log(`ℹ️  Cupom ${codigoCupom} já existe, reutilizando...`);
            return codigoCupom;
        }

        // Cria cupom com validade de 30 dias
        const validade = new Date();
        validade.setDate(validade.getDate() + 30);

        const { error } = await supabase
            .from('cupons')
            .insert({
                codigo: codigoCupom,
                tipo: 'porcentagem',
                valor: 10,
                validade: validade.toISOString().split('T')[0],
                quantidade_usada: 0,
                ativo: true
            });

        if (error) {
            console.error(`❌ Erro ao criar cupom ${codigoCupom}:`, error);
            return null;
        }

        console.log(`✅ Cupom ${codigoCupom} criado com sucesso`);
        return codigoCupom;

    } catch (error) {
        console.error('❌ Erro ao criar cupom:', error);
        return null;
    }
}

/**
 * Busca lojas ativas no sistema
 */
async function buscarLojasAtivas() {
    try {
        const { data: lojas, error } = await supabase
            .from('lojas')
            .select('*')
            .eq('ativa', true);

        if (error) throw error;

        console.log(`✅ Encontradas ${lojas?.length || 0} lojas ativas`);
        return lojas || [];

    } catch (error) {
        console.error('❌ Erro ao buscar lojas:', error);
        return [];
    }
}

/**
 * Envia mensagem de aniversário via bot WhatsApp
 */
async function enviarMensagemAniversario(cliente, cupomCodigo, lojas) {
    try {
        const PORT = process.env.PORT || 3001;
        const response = await fetch(`http://localhost:${PORT}/enviar-mensagem-aniversario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telefone: cliente.telefone,
                nome: cliente.nome_completo,
                cupom_codigo: cupomCodigo,
                lojas: lojas
            })
        });

        if (response.ok) {
            console.log(`✅ Mensagem enviada para ${cliente.nome_completo}`);
            return true;
        } else {
            console.error(`❌ Falha ao enviar para ${cliente.nome_completo}`);
            return false;
        }

    } catch (error) {
        console.error(`❌ Erro ao enviar mensagem para ${cliente.nome_completo}:`, error);
        return false;
    }
}

/**
 * Função principal
 */
async function executarVerificacaoAniversarios() {
    console.log('🎉 === INICIANDO VERIFICAÇÃO DE ANIVERSÁRIOS ===');
    console.log(`⏰ Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    try {
        // 1. Buscar aniversariantes
        const aniversariantes = await buscarAniversariantesHoje();

        if (aniversariantes.length === 0) {
            console.log('ℹ️  Nenhum aniversariante hoje. Finalizando...');
            return;
        }

        // 2. Buscar lojas ativas
        const lojas = await buscarLojasAtivas();

        // 3. Processar cada aniversariante
        for (const cliente of aniversariantes) {
            console.log(`\n📝 Processando: ${cliente.nome_completo}`);

            // 3.1 Criar cupom personalizado
            const cupomCodigo = await criarCupomAniversario(cliente);

            if (!cupomCodigo) {
                console.log(`⚠️  Pulando ${cliente.nome_completo} - falha ao criar cupom`);
                continue;
            }

            // 3.2 Enviar mensagem
            await enviarMensagemAniversario(cliente, cupomCodigo, lojas);

            // 3.3 Bonus de aniversario no sistema de fidelidade
            try {
                const anoAtual = new Date().getFullYear();
                if (cliente.aniversario_fidelidade_ano !== anoAtual) {
                    const { data: cfg } = await supabase
                        .from('fidelidade_config')
                        .select('aniversario_ativo, aniversario_coroas')
                        .eq('is_active', true)
                        .maybeSingle();
                    if (cfg && cfg.aniversario_ativo) {
                        const coroas = cfg.aniversario_coroas || 50;
                        const novoSaldo = (cliente.coroas || 0) + coroas;
                        await supabase.from('clientes')
                            .update({ coroas: novoSaldo, aniversario_fidelidade_ano: anoAtual })
                            .eq('id', cliente.id);
                        await supabase.from('fidelidade_historico').insert({
                            cliente_id: cliente.id,
                            tipo_evento: 'aniversario',
                            coroas,
                            descricao: `Bonus de aniversario ${anoAtual}`,
                            saldo_apos: novoSaldo
                        });
                        console.log(`+${coroas} Coroas de aniversario para ${cliente.nome_completo}`);
                    }
                }
            } catch (e) {
                console.error('Erro bonus aniversario fidelidade:', e.message);
            }

            // Delay entre mensagens para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log('\n✅ === VERIFICAÇÃO CONCLUÍDA ===');

    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

// Se executado diretamente (não via cron)
if (require.main === module) {
    executarVerificacaoAniversarios().then(() => {
        console.log('\n🏁 Script finalizado');
        process.exit(0);
    });
}

module.exports = executarVerificacaoAniversarios;
