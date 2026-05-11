/**
 * Motor de Fidelidade - Sistema Progressivo Expandido
 *
 * Gatilhos de ganho suportados:
 *   compra, cadastro, aniversario, indicacao, avaliacao,
 *   frequencia, produto_especifico, pagamento_avista, campanha manual
 *
 * Resgate:
 *   resgatarCoroasDesconto -- converte coroas em valor de desconto
 *   resgatarRecompensa     -- gera codigo de cupom via catalogo classico
 *
 * Historico:
 *   Toda operacao registra uma linha em fidelidade_historico
 */

import { supabase } from "@/api/base44Client";

const log = (...args) => { if (import.meta.env.DEV) console.log(...args); };
const logError = (...args) => { if (import.meta.env.DEV) console.error(...args); };

// --- Helper interno: registrar evento no historico ---
async function registrarHistorico(clienteId, tipoEvento, coroas, descricao, referenciaId = null, saldoApos = null) {
    try {
        await supabase.from('fidelidade_historico').insert({
            cliente_id: clienteId,
            tipo_evento: tipoEvento,
            coroas,
            descricao,
            referencia_id: referenciaId,
            saldo_apos: saldoApos,
        });
    } catch (err) {
        logError('Erro ao registrar historico de fidelidade:', err);
    }
}

// --- Helper interno: atualizar saldo do cliente ---
async function atualizarSaldo(clienteId, novoSaldo, tierId) {
    const updateData = { coroas: novoSaldo };
    if (tierId !== undefined) updateData.tier_id = tierId;
    const { error } = await supabase.from('clientes').update(updateData).eq('id', clienteId);
    return error;
}

// --- Helper interno: verificar promocao de tier ---
async function verificarPromocaoTier(coroas) {
    try {
        const { data: tiers } = await supabase
            .from('fidelidade_tiers')
            .select('id, coroas_minimas')
            .eq('is_active', true)
            .order('coroas_minimas', { ascending: false });
        if (!tiers || tiers.length === 0) return null;
        for (const tier of tiers) {
            if (coroas >= tier.coroas_minimas) return tier.id;
        }
        return null;
    } catch (err) {
        logError('Erro ao verificar tier:', err);
        return null;
    }
}

// --- Helper interno: buscar config ativa ---
async function buscarConfig() {
    const { data } = await supabase
        .from('fidelidade_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
    return data;
}

// =============================================================================
// 1. COMPRA
// =============================================================================

/**
 * Processa coroas para uma compra finalizada.
 * @param {object} cliente
 * @param {number} valorCompra
 * @param {string} numeroPedido
 * @param {string} [vendaId]
 * @param {string} [formaPagamento]
 * @param {Array}  [itensCompra]   Array de { categoria, ... }
 */
export async function processarFidelidadeCompra(
    cliente, valorCompra, numeroPedido,
    vendaId = null, formaPagamento = '', itensCompra = []
) {
    try {
        if (!cliente?.id) return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };

        const config = await buscarConfig();
        if (!config) return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };

        // Multiplicador do tier
        let multiplicador = 1.0;
        let tierNome = 'Bronze';
        if (cliente.tier_id) {
            const { data: tier } = await supabase
                .from('fidelidade_tiers')
                .select('nome, multiplicador_coroas')
                .eq('id', cliente.tier_id)
                .single();
            if (tier) { multiplicador = tier.multiplicador_coroas || 1.0; tierNome = tier.nome; }
        }

        // Coroas da compra base
        const valorPorUnidade = config.purchase_value_threshold || 50;
        const coroasPorUnidade = config.steps_per_purchase || 2;
        const unidades = Math.floor(valorCompra / valorPorUnidade);
        const coroasCompra = Math.round(unidades * coroasPorUnidade * multiplicador);

        let totalCoroas = coroasCompra;

        // Bonus produto/categoria especifico
        let coroasProduto = 0;
        if (config.produto_especifico_ativo && itensCompra.length > 0) {
            coroasProduto = await _calcularBonosProdutos(itensCompra, multiplicador);
            totalCoroas += coroasProduto;
        }

        // Bonus pagamento a vista
        let coroasAvista = 0;
        const PAGAMENTOS_AVISTA = ['dinheiro', 'pix', 'debito', 'a vista', 'avista'];
        const ehAvista = PAGAMENTOS_AVISTA.some(p => formaPagamento.toLowerCase().includes(p));
        if (config.pagamento_avista_ativo && ehAvista) {
            coroasAvista = config.pagamento_avista_coroas || 10;
            totalCoroas += coroasAvista;
        }

        if (totalCoroas <= 0) {
            return { sucesso: true, coroasGanhas: 0, novoSaldo: cliente.coroas || 0 };
        }

        const saldoAtual = cliente.coroas || 0;
        const novoSaldo = saldoAtual + totalCoroas;
        const novoTierId = await verificarPromocaoTier(novoSaldo);
        const updateError = await atualizarSaldo(cliente.id, novoSaldo, novoTierId || undefined);

        if (updateError) {
            logError('Erro ao atualizar coroas:', updateError);
            return { sucesso: false, coroasGanhas: 0, novoSaldo: saldoAtual };
        }

        await registrarHistorico(
            cliente.id, 'compra', coroasCompra,
            `Pedido #${numeroPedido} - R$ ${valorCompra.toFixed(2)} - Tier ${tierNome} (${multiplicador}x)`,
            vendaId, novoSaldo
        );
        if (coroasProduto > 0) {
            await registrarHistorico(cliente.id, 'produto_especifico', coroasProduto,
                `Bonus categorias especiais - Pedido #${numeroPedido}`, vendaId, novoSaldo);
        }
        if (coroasAvista > 0) {
            await registrarHistorico(cliente.id, 'pagamento_avista', coroasAvista,
                `Bonus pagamento ${formaPagamento} - Pedido #${numeroPedido}`, vendaId, novoSaldo);
        }

        // Frequencia (verificar apos gravar compra)
        await _processarFidelidadeFrequencia(cliente.id, config);

        // Indicacao (verificar se e a 1a compra do cliente)
        try {
            const { count } = await supabase.from('vendas')
                .select('id', { count: 'exact', head: true }).eq('cliente_id', cliente.id);
            if (count === 1) await processarFidelidadeIndicacao(cliente.id);
        } catch (_) { /* nao critico */ }

        log(`Pedido ${numeroPedido}: +${totalCoroas} Coroas (${saldoAtual} -> ${novoSaldo})`);
        return {
            sucesso: true, coroasGanhas: totalCoroas, novoSaldo, tier: tierNome,
            multiplicador, detalhe: `A cada R$ ${valorPorUnidade} = ${coroasPorUnidade} Coroas`
        };
    } catch (error) {
        logError('Erro no motor de fidelidade:', error);
        return { sucesso: false, coroasGanhas: 0, novoSaldo: 0 };
    }
}

// =============================================================================
// 2. CADASTRO
// =============================================================================

export async function processarFidelidadeCadastro(cliente) {
    try {
        if (!cliente?.id) return { sucesso: false, coroasGanhas: 0 };
        const config = await buscarConfig();
        if (!config?.signup_bonus) return { sucesso: false, coroasGanhas: 0 };

        const bonus = config.signup_bonus;
        const saldoAtual = cliente.coroas || 0;
        const novoSaldo = saldoAtual + bonus;
        await atualizarSaldo(cliente.id, novoSaldo);
        await registrarHistorico(cliente.id, 'cadastro', bonus, 'Bonus de boas-vindas', null, novoSaldo);
        log(`Novo cliente ${cliente.nome_completo}: +${bonus} Coroas`);
        return { sucesso: true, coroasGanhas: bonus, novoSaldo };
    } catch (error) {
        logError('Erro no bonus de cadastro:', error);
        return { sucesso: false, coroasGanhas: 0 };
    }
}

// =============================================================================
// 3. ANIVERSARIO
// =============================================================================

export async function processarFidelidadeAniversario(clienteId) {
    try {
        const config = await buscarConfig();
        if (!config?.aniversario_ativo) return { sucesso: false, coroasGanhas: 0 };

        const { data: cliente } = await supabase
            .from('clientes')
            .select('id, coroas, nome_completo, aniversario_fidelidade_ano, data_nascimento')
            .eq('id', clienteId).single();
        if (!cliente) return { sucesso: false, coroasGanhas: 0 };

        const anoAtual = new Date().getFullYear();
        if (cliente.aniversario_fidelidade_ano === anoAtual) {
            return { sucesso: false, coroasGanhas: 0, motivo: 'Ja concedido este ano' };
        }

        if (cliente.data_nascimento) {
            const hoje = new Date();
            const [, mesNasc, diaNasc] = cliente.data_nascimento.split('-').map(Number);
            if (hoje.getDate() !== diaNasc || (hoje.getMonth() + 1) !== mesNasc) {
                return { sucesso: false, coroasGanhas: 0, motivo: 'Nao e aniversario hoje' };
            }
        }

        const coroas = config.aniversario_coroas || 50;
        const novoSaldo = (cliente.coroas || 0) + coroas;
        await supabase.from('clientes').update({ coroas: novoSaldo, aniversario_fidelidade_ano: anoAtual }).eq('id', clienteId);
        await registrarHistorico(clienteId, 'aniversario', coroas, `Bonus de aniversario ${anoAtual}`, null, novoSaldo);
        log(`${cliente.nome_completo}: +${coroas} Coroas de aniversario`);
        return { sucesso: true, coroasGanhas: coroas, novoSaldo };
    } catch (error) {
        logError('Erro no bonus de aniversario:', error);
        return { sucesso: false, coroasGanhas: 0 };
    }
}

// =============================================================================
// 4. INDICACAO
// =============================================================================

export async function processarFidelidadeIndicacao(clienteIndicadoId) {
    try {
        const config = await buscarConfig();
        if (!config?.indicacao_ativo) return { sucesso: false, coroasGanhas: 0 };

        const { data: indicado } = await supabase
            .from('clientes').select('id, indicado_por').eq('id', clienteIndicadoId).single();
        if (!indicado?.indicado_por) return { sucesso: false, coroasGanhas: 0 };

        const { count } = await supabase.from('vendas')
            .select('id', { count: 'exact', head: true }).eq('cliente_id', clienteIndicadoId);
        if (count !== 1) return { sucesso: false, coroasGanhas: 0, motivo: 'Nao e a 1a compra' };

        const { data: indicador } = await supabase
            .from('clientes').select('id, coroas, nome_completo').eq('id', indicado.indicado_por).single();
        if (!indicador) return { sucesso: false, coroasGanhas: 0 };

        const coroas = config.indicacao_coroas || 30;
        const novoSaldo = (indicador.coroas || 0) + coroas;
        const novoTierId = await verificarPromocaoTier(novoSaldo);
        await atualizarSaldo(indicador.id, novoSaldo, novoTierId || undefined);
        await registrarHistorico(indicador.id, 'indicacao', coroas,
            `Indicacao de novo cliente ID ${clienteIndicadoId}`, clienteIndicadoId, novoSaldo);
        log(`${indicador.nome_completo}: +${coroas} Coroas por indicacao`);
        return { sucesso: true, coroasGanhas: coroas, novoSaldo };
    } catch (error) {
        logError('Erro no bonus de indicacao:', error);
        return { sucesso: false, coroasGanhas: 0 };
    }
}

// =============================================================================
// 5. AVALIACAO
// =============================================================================

export async function processarFidelidadeAvaliacao(clienteId) {
    try {
        const config = await buscarConfig();
        if (!config?.avaliacao_ativo) return { sucesso: false, coroasGanhas: 0 };

        const { data: cliente } = await supabase
            .from('clientes')
            .select('id, coroas, nome_completo, ultima_avaliacao_fidelidade')
            .eq('id', clienteId).single();
        if (!cliente) return { sucesso: false, coroasGanhas: 0 };

        if (cliente.ultima_avaliacao_fidelidade) {
            const dias = (Date.now() - new Date(cliente.ultima_avaliacao_fidelidade).getTime()) / 86400000;
            if (dias < 30) return { sucesso: false, coroasGanhas: 0, motivo: `Aguardar ${Math.ceil(30 - dias)} dias` };
        }

        const coroas = config.avaliacao_coroas || 10;
        const novoSaldo = (cliente.coroas || 0) + coroas;
        await supabase.from('clientes').update({
            coroas: novoSaldo, ultima_avaliacao_fidelidade: new Date().toISOString()
        }).eq('id', clienteId);
        await registrarHistorico(clienteId, 'avaliacao', coroas, 'Bonus por avaliacao', null, novoSaldo);
        log(`${cliente.nome_completo}: +${coroas} Coroas por avaliacao`);
        return { sucesso: true, coroasGanhas: coroas, novoSaldo };
    } catch (error) {
        logError('Erro no bonus de avaliacao:', error);
        return { sucesso: false, coroasGanhas: 0 };
    }
}

// =============================================================================
// 6. FREQUENCIA (interno)
// =============================================================================

async function _processarFidelidadeFrequencia(clienteId, config) {
    try {
        if (!config?.frequencia_ativo) return;
        const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
        const { count } = await supabase.from('vendas')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', clienteId).gte('data_venda', inicioMes.toISOString());
        const minima = config.frequencia_minima || 2;
        if (count !== minima) return;
        const { data: cliente } = await supabase.from('clientes').select('id, coroas').eq('id', clienteId).single();
        if (!cliente) return;
        const coroas = config.frequencia_coroas || 20;
        const novoSaldo = (cliente.coroas || 0) + coroas;
        await atualizarSaldo(clienteId, novoSaldo);
        await registrarHistorico(clienteId, 'frequencia', coroas,
            `Bonus de frequencia - ${count}a compra do mes`, null, novoSaldo);
        log(`+${coroas} Coroas por frequencia (${count} compras este mes)`);
    } catch (err) {
        logError('Erro no bonus de frequencia:', err);
    }
}

// =============================================================================
// 7. PRODUTO / CATEGORIA ESPECIFICO (interno)
// =============================================================================

async function _calcularBonosProdutos(itens, multiplicador) {
    try {
        const { data: categorias } = await supabase
            .from('fidelidade_categorias_bonus')
            .select('categoria, coroas_bonus, multiplicador').eq('is_active', true);
        if (!categorias || categorias.length === 0) return 0;
        let total = 0;
        for (const item of itens) {
            const cat = (item.categoria || '').toLowerCase();
            const match = categorias.find(c => cat.includes(c.categoria.toLowerCase()));
            if (match) total += Math.round((match.coroas_bonus || 0) * (match.multiplicador || 1) * multiplicador);
        }
        return total;
    } catch (err) {
        logError('Erro no bonus de produto:', err);
        return 0;
    }
}

// =============================================================================
// 8. CAMPANHA MANUAL (admin)
// =============================================================================

export async function adicionarCoroas(clienteId, quantidade, motivo) {
    try {
        const { data: cliente } = await supabase
            .from('clientes').select('id, coroas, nome_completo').eq('id', clienteId).single();
        if (!cliente) return { sucesso: false };
        const novoSaldo = Math.max(0, (cliente.coroas || 0) + quantidade);
        const novoTierId = await verificarPromocaoTier(novoSaldo);
        await atualizarSaldo(clienteId, novoSaldo, novoTierId || undefined);
        await registrarHistorico(clienteId, 'campanha', quantidade, motivo || 'Ajuste manual', null, novoSaldo);
        log(`Campanha: ${cliente.nome_completo} ${quantidade > 0 ? '+' : ''}${quantidade} Coroas`);
        return { sucesso: true, novoSaldo };
    } catch (err) {
        logError('Erro na campanha manual:', err);
        return { sucesso: false };
    }
}

// =============================================================================
// 9. RESGATE - DESCONTO DIRETO
// =============================================================================

export async function resgatarCoroasDesconto(cliente, coroasParaResgatar) {
    try {
        if (!cliente?.id) return { sucesso: false, mensagem: 'Cliente nao informado' };
        const config = await buscarConfig();
        const descontoPorCoroa = config?.desconto_por_coroa || 0.10;
        const minimo = config?.reward_threshold || 100;
        const saldoAtual = cliente.coroas || 0;
        if (saldoAtual < coroasParaResgatar) return { sucesso: false, mensagem: `Saldo insuficiente (${saldoAtual} Coroas)` };
        if (coroasParaResgatar < minimo) return { sucesso: false, mensagem: `Minimo para resgate: ${minimo} Coroas` };

        const valorDesconto = parseFloat((coroasParaResgatar * descontoPorCoroa).toFixed(2));
        const novoSaldo = saldoAtual - coroasParaResgatar;
        const codigo = `DESC-${Date.now().toString(36).toUpperCase()}`;
        await atualizarSaldo(cliente.id, novoSaldo);
        await registrarHistorico(cliente.id, 'resgate', -coroasParaResgatar,
            `Resgate de ${coroasParaResgatar} Coroas = R$ ${valorDesconto.toFixed(2)} de desconto`, null, novoSaldo);

        const expiracao = new Date(); expiracao.setDate(expiracao.getDate() + 30);
        await supabase.from('cliente_recompensas').insert({
            cliente_id: cliente.id, codigo_cupom: codigo, status: 'disponivel',
            expira_em: expiracao.toISOString(),
        });

        log(`Resgate: ${coroasParaResgatar} Coroas -> R$ ${valorDesconto} | ${codigo}`);
        return { sucesso: true, valorDesconto, novoSaldo, codigo };
    } catch (err) {
        logError('Erro no resgate de desconto:', err);
        return { sucesso: false, mensagem: 'Erro ao processar resgate.' };
    }
}

// =============================================================================
// 10. RESGATE - CUPOM DO CATALOGO (modelo classico)
// =============================================================================

export async function resgatarRecompensa(cliente, recompensa) {
    try {
        const saldoAtual = cliente.coroas || 0;
        const coroasNecessarias = recompensa.coroas_necessarias || 0;
        if (saldoAtual < coroasNecessarias) {
            return { sucesso: false, mensagem: `Saldo insuficiente. Voce tem ${saldoAtual} Coroas, precisa de ${coroasNecessarias}.` };
        }
        const codigo = `FID-${Date.now().toString(36).toUpperCase()}`;
        const expiracao = new Date(); expiracao.setDate(expiracao.getDate() + (recompensa.expiracao_dias || 30));
        await supabase.from('cliente_recompensas').insert({
            cliente_id: cliente.id, recompensa_id: recompensa.id,
            codigo_cupom: codigo, status: 'disponivel', expira_em: expiracao.toISOString()
        });
        let novoSaldo = saldoAtual;
        if (recompensa.desconta_coroas !== false) {
            novoSaldo = saldoAtual - coroasNecessarias;
            await atualizarSaldo(cliente.id, novoSaldo);
        }
        await registrarHistorico(cliente.id, 'resgate', -(recompensa.desconta_coroas !== false ? coroasNecessarias : 0),
            `Resgate: ${recompensa.fidelidade_regras?.nome || recompensa.reward_type} - Cod. ${codigo}`,
            recompensa.id, novoSaldo);
        log(`Resgate catalogo: ${codigo}`);
        return { sucesso: true, codigo, novoSaldo, mensagem: recompensa.mensagem_cliente || `Resgate realizado! Codigo: ${codigo}` };
    } catch (err) {
        logError('Erro ao resgatar recompensa:', err);
        return { sucesso: false, mensagem: 'Erro ao processar resgate.' };
    }
}

// =============================================================================
// 11. EXPIRACAO
// =============================================================================

export async function verificarExpiracao(cliente) {
    try {
        const config = await buscarConfig();
        if (!config?.expiracao_ativo) return { expirou: false };
        const ultimaCompra = cliente.ultima_compra ? new Date(cliente.ultima_compra) : null;
        if (!ultimaCompra) return { expirou: false };
        const { expiracao_valor: valor = 12, expiracao_unidade: unidade = 'meses' } = config;
        const limite = new Date(ultimaCompra);
        if (unidade === 'horas')   limite.setHours(limite.getHours() + valor);
        if (unidade === 'dias')    limite.setDate(limite.getDate() + valor);
        if (unidade === 'semanas') limite.setDate(limite.getDate() + valor * 7);
        if (unidade === 'meses')   limite.setMonth(limite.getMonth() + valor);
        if (unidade === 'anos')    limite.setFullYear(limite.getFullYear() + valor);
        if (new Date() < limite) return { expirou: false };
        const coroasExpiradas = cliente.coroas || 0;
        if (coroasExpiradas === 0) return { expirou: false };
        await atualizarSaldo(cliente.id, 0);
        await registrarHistorico(cliente.id, 'expiracao', -coroasExpiradas,
            `Coroas expiradas por inatividade (${valor} ${unidade})`, null, 0);
        log(`${cliente.nome_completo}: ${coroasExpiradas} Coroas expiraram`);
        return { expirou: true, coroasExpiradas };
    } catch (err) {
        logError('Erro na verificacao de expiracao:', err);
        return { expirou: false };
    }
}

// =============================================================================
// 12. UTILITARIOS EXPORTADOS
// =============================================================================

export async function buscarTiers() {
    try {
        const { data, error } = await supabase
            .from('fidelidade_tiers').select('*').eq('is_active', true).order('ordem', { ascending: true });
        if (error) throw error;
        return data || [];
    } catch (err) {
        logError('Erro ao buscar tiers:', err);
        return [];
    }
}

export async function buscarCatalogoRecompensas() {
    try {
        const { data, error } = await supabase
            .from('fidelidade_recompensas')
            .select(`id, reward_type, value, coroas_necessarias, desconta_coroas, expiracao_dias, mensagem_cliente,
                fidelidade_regras!inner (nome, is_active)`)
            .gt('coroas_necessarias', 0).order('coroas_necessarias', { ascending: true });
        if (error) throw error;
        return (data || []).filter(r => r.fidelidade_regras?.is_active);
    } catch (err) {
        logError('Erro ao buscar catalogo:', err);
        return [];
    }
}

export async function buscarHistoricoCliente(clienteId, limite = 20) {
    try {
        const { data, error } = await supabase
            .from('fidelidade_historico').select('*').eq('cliente_id', clienteId)
            .order('created_at', { ascending: false }).limit(limite);
        if (error) throw error;
        return data || [];
    } catch (err) {
        logError('Erro ao buscar historico:', err);
        return [];
    }
}

export function formatarTipoRecompensa(tipo, valor) {
    switch (tipo) {
        case 'cupom_percentual':  return `Cupom ${valor}% de desconto`;
        case 'cupom_valor':       return `Cupom R$ ${valor} de desconto`;
        case 'frete_gratis':      return 'Frete Gratis';
        case 'item_gratis':       return 'Item Gratis';
        case 'cashback':          return `R$ ${valor} de Cashback`;
        case 'desconto_proximo':  return `${valor}% na proxima compra`;
        default:                  return `${valor} ${tipo}`;
    }
}

export function formatarTipoEvento(tipo) {
    const labels = {
        compra: 'Compra', cadastro: 'Cadastro', aniversario: 'Aniversario',
        indicacao: 'Indicacao', avaliacao: 'Avaliacao', frequencia: 'Frequencia',
        produto_especifico: 'Produto especial', pagamento_avista: 'Pag. a vista',
        campanha: 'Campanha', resgate: 'Resgate', expiracao: 'Expiracao',
    };
    return labels[tipo] || tipo;
}
