/**
 * Motor de Fidelidade - Sistema Progressivo Simplificado
 * 
 * Modelo: A cada R$ X em compras = Y Coroas
 * Exemplo: A cada R$ 50 = 10 Coroas → Compra de R$ 100 = 20 Coroas
 */

import { supabase } from "@/api/base44Client";

// Helper para log seguro (apenas em desenvolvimento)
const log = (...args) => {
    if (import.meta.env.DEV) {
        console.log(...args);
    }
};

const logError = (...args) => {
    if (import.meta.env.DEV) {
        console.error(...args);
    }
};

/**
 * Calcula e adiciona coroas para uma compra
 * Fórmula: Math.floor(valorCompra / valorPorCoroa) * coroasPorUnidade
 * 
 * @param {object} cliente - Cliente que fez a compra
 * @param {number} valorCompra - Valor total da compra
 * @param {string} numeroPedido - Número do pedido para log
 * @returns {Promise<{sucesso: boolean, coroasGanhas: number, novoSaldo: number}>}
 */
export async function processarFidelidadeCompra(cliente, valorCompra, numeroPedido) {
    try {
        if (!cliente?.id) {
            log('⚠️ Fidelidade: Cliente não informado');
            return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };
        }

        // 1. Buscar configuração global de fidelidade
        const { data: config, error: configError } = await supabase
            .from('fidelidade_config')
            .select('*')
            .eq('is_active', true)
            .single();

        if (configError || !config) {
            log('ℹ️ Fidelidade: Configuração não encontrada ou inativa');
            return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };
        }

        // 2. Buscar tier do cliente para aplicar multiplicador
        let multiplicador = 1.0;
        let tierNome = 'Bronze';

        if (cliente.tier_id) {
            const { data: tier } = await supabase
                .from('fidelidade_tiers')
                .select('nome, multiplicador_coroas')
                .eq('id', cliente.tier_id)
                .single();

            if (tier) {
                multiplicador = tier.multiplicador_coroas || 1.0;
                tierNome = tier.nome;
            }
        }

        // 3. Calcular coroas progressivamente com multiplicador do tier
        // purchase_value_threshold = valor em R$ para ganhar coroas (ex: 50)
        // steps_per_purchase = coroas ganhas por unidade (ex: 10)
        const valorPorUnidade = config.purchase_value_threshold || 50;
        const coroasPorUnidade = config.steps_per_purchase || 2;

        const unidadesGanhas = Math.floor(valorCompra / valorPorUnidade);
        const coroasBase = unidadesGanhas * coroasPorUnidade;
        const coroasGanhas = Math.round(coroasBase * multiplicador);

        if (coroasGanhas <= 0) {
            log(`ℹ️ Compra de R$ ${valorCompra} não atingiu valor mínimo de R$ ${valorPorUnidade}`);
            return { sucesso: true, coroasGanhas: 0, novoSaldo: cliente.coroas || 0 };
        }

        // 4. Atualizar saldo do cliente
        const saldoAtual = cliente.coroas || cliente.passos || 0;
        const novoSaldo = saldoAtual + coroasGanhas;

        // 5. Verificar se deve subir de tier
        const novoTierId = await verificarPromocaoTier(novoSaldo);

        const { error: updateError } = await supabase
            .from('clientes')
            .update({
                coroas: novoSaldo,
                passos: novoSaldo, // Manter compatibilidade
                ultima_compra: new Date().toISOString(),
                ...(novoTierId ? { tier_id: novoTierId } : {})
            })
            .eq('id', cliente.id);

        if (updateError) {
            logError('❌ Erro ao atualizar coroas:', updateError);
            return { sucesso: false, coroasGanhas: 0, novoSaldo: saldoAtual };
        }

        const bonusInfo = multiplicador > 1 ? ` (${tierNome}: +${Math.round((multiplicador - 1) * 100)}%)` : '';
        log(`👑 Pedido ${numeroPedido}: R$ ${valorCompra} → +${coroasGanhas} Coroas${bonusInfo} (${saldoAtual} → ${novoSaldo})`);

        return {
            sucesso: true,
            coroasGanhas,
            novoSaldo,
            tier: tierNome,
            multiplicador,
            detalhe: `A cada R$ ${valorPorUnidade} = ${coroasPorUnidade} Coroas`
        };

    } catch (error) {
        logError('❌ Erro no motor de fidelidade:', error);
        return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };
    }
}

/**
 * Verifica se o cliente deve subir de tier baseado no saldo de coroas
 * @param {number} coroas - Saldo atual de coroas
 * @returns {Promise<string|null>} ID do novo tier ou null se não mudar
 */
async function verificarPromocaoTier(coroas) {
    try {
        const { data: tiers } = await supabase
            .from('fidelidade_tiers')
            .select('id, nome, coroas_minimas')
            .eq('is_active', true)
            .order('coroas_minimas', { ascending: false });

        if (!tiers || tiers.length === 0) return null;

        // Encontrar o maior tier que o cliente qualifica
        for (const tier of tiers) {
            if (coroas >= tier.coroas_minimas) {
                return tier.id;
            }
        }

        return null;
    } catch (error) {
        logError('❌ Erro ao verificar promoção de tier:', error);
        return null;
    }
}

/**
 * Busca todos os tiers disponíveis
 */
export async function buscarTiers() {
    try {
        const { data, error } = await supabase
            .from('fidelidade_tiers')
            .select('*')
            .eq('is_active', true)
            .order('ordem', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        logError('❌ Erro ao buscar tiers:', error);
        return [];
    }
}

/**
 * Processa bônus de cadastro
 * @param {object} cliente - Cliente recém cadastrado
 */
export async function processarFidelidadeCadastro(cliente) {
    try {
        if (!cliente?.id) return { sucesso: false, coroasGanhas: 0 };

        // Buscar configuração de bônus de cadastro
        const { data: config } = await supabase
            .from('fidelidade_config')
            .select('signup_bonus, is_active')
            .eq('is_active', true)
            .single();

        if (!config || !config.signup_bonus) {
            return { sucesso: false, coroasGanhas: 0 };
        }

        const bonus = config.signup_bonus;
        const saldoAtual = cliente.coroas || 0;
        const novoSaldo = saldoAtual + bonus;

        await supabase
            .from('clientes')
            .update({ coroas: novoSaldo, passos: novoSaldo })
            .eq('id', cliente.id);

        log(`🎉 Novo cliente ${cliente.nome_completo}: +${bonus} Coroas de bônus`);

        return { sucesso: true, coroasGanhas: bonus, novoSaldo };

    } catch (error) {
        logError('❌ Erro no bônus de cadastro:', error);
        return { sucesso: false, coroasGanhas: 0 };
    }
}

/**
 * Busca catálogo de recompensas disponíveis para resgate
 * @returns {Promise<array>} Lista de recompensas ordenadas por coroas necessárias
 */
export async function buscarCatalogoRecompensas() {
    try {
        const { data, error } = await supabase
            .from('fidelidade_recompensas')
            .select(`
                id,
                reward_type,
                value,
                coroas_necessarias,
                desconta_coroas,
                expiracao_dias,
                mensagem_cliente,
                fidelidade_regras!inner (
                    nome,
                    is_active
                )
            `)
            .gt('coroas_necessarias', 0)
            .order('coroas_necessarias', { ascending: true });

        if (error) throw error;

        // Filtrar apenas regras ativas
        return (data || []).filter(r => r.fidelidade_regras?.is_active);

    } catch (error) {
        logError('❌ Erro ao buscar catálogo:', error);
        return [];
    }
}

/**
 * Resgata uma recompensa usando coroas
 * @param {object} cliente - Cliente resgatando
 * @param {object} recompensa - Recompensa do catálogo
 * @returns {Promise<{sucesso: boolean, codigo: string, mensagem: string}>}
 */
export async function resgatarRecompensa(cliente, recompensa) {
    try {
        const saldoAtual = cliente.coroas || 0;
        const coroasNecessarias = recompensa.coroas_necessarias || 0;

        if (saldoAtual < coroasNecessarias) {
            return {
                sucesso: false,
                mensagem: `Saldo insuficiente. Você tem ${saldoAtual} Coroas, precisa de ${coroasNecessarias}.`
            };
        }

        // Gerar código do cupom se aplicável
        const codigo = `FID-${Date.now().toString(36).toUpperCase()}`;
        const expiracao = new Date();
        expiracao.setDate(expiracao.getDate() + (recompensa.expiracao_dias || 30));

        // Criar registro da recompensa
        await supabase
            .from('cliente_recompensas')
            .insert({
                cliente_id: cliente.id,
                recompensa_id: recompensa.id,
                codigo_cupom: codigo,
                status: 'disponivel',
                expira_em: expiracao.toISOString()
            });

        // Descontar coroas se configurado
        let novoSaldo = saldoAtual;
        if (recompensa.desconta_coroas !== false) {
            novoSaldo = saldoAtual - coroasNecessarias;
            await supabase
                .from('clientes')
                .update({ coroas: novoSaldo, passos: novoSaldo })
                .eq('id', cliente.id);

            log(`🎁 Resgate: ${coroasNecessarias} Coroas → ${recompensa.reward_type} (saldo: ${saldoAtual} → ${novoSaldo})`);
        } else {
            log(`🎁 Resgate SEM desconto: ${recompensa.reward_type}`);
        }

        return {
            sucesso: true,
            codigo,
            novoSaldo,
            mensagem: recompensa.mensagem_cliente || `Resgate realizado! Código: ${codigo}`
        };

    } catch (error) {
        logError('❌ Erro ao resgatar recompensa:', error);
        return { sucesso: false, mensagem: 'Erro ao processar resgate.' };
    }
}

/**
 * Formata tipo de recompensa para exibição
 */
export function formatarTipoRecompensa(tipo, valor) {
    switch (tipo) {
        case 'cupom_percentual': return `Cupom ${valor}% de desconto`;
        case 'cupom_valor': return `Cupom R$ ${valor} de desconto`;
        case 'frete_gratis': return 'Frete Grátis';
        case 'item_gratis': return 'Item Grátis';
        case 'cashback': return `R$ ${valor} de Cashback`;
        case 'desconto_proximo': return `${valor}% na próxima compra`;
        default: return `${valor} ${tipo}`;
    }
}
