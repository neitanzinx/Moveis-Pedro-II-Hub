import { supabase } from '@/lib/supabase';

function handleResponse({ data, error }, customMessage) {
    if (error) {
        console.error(customMessage || 'Erro no serviço financeiro:', error);
        throw new Error(customMessage || error.message);
    }
    return data;
}

export const comprasFinanceiroService = {

    // ------------------------------------------------------------------
    // CONTAS A PAGAR (CRUD)
    // ------------------------------------------------------------------

    async getContasPagar(filters = {}) {
        let query = supabase
            .from('compras_contas_pagar')
            .select('*, ordem:ordem_compra_id(numero_pedido, status, valor_total)')
            .order('data_vencimento', { ascending: true });

        if (filters.fornecedor_id) {
            query = query.eq('fornecedor_id', filters.fornecedor_id);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.de) {
            query = query.gte('data_vencimento', filters.de);
        }
        if (filters.ate) {
            query = query.lte('data_vencimento', filters.ate);
        }

        const { data, error } = await query;
        return handleResponse({ data, error }, 'Erro ao buscar contas a pagar');
    },

    async createContaPagar(contaData) {
        const { data, error } = await supabase
            .from('compras_contas_pagar')
            .insert(contaData)
            .select()
            .single();
        return handleResponse({ data, error }, 'Erro ao criar conta a pagar');
    },

    async updateContaPagar(id, updateData) {
        const { data, error } = await supabase
            .from('compras_contas_pagar')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        return handleResponse({ data, error }, 'Erro ao atualizar conta a pagar');
    },

    async marcarComoPago(id) {
        return this.updateContaPagar(id, {
            status: 'pago',
            data_pagamento: new Date().toISOString().split('T')[0]
        });
    },

    // ------------------------------------------------------------------
    // AUTO-GERAÇÃO DE COMPROMISSO (quando pedido é recebido)
    // ------------------------------------------------------------------

    async gerarCompromissoPedido(ordem, parcelas = 1) {
        // Se pagamento é à vista, marca como pago imediatamente
        const isAvista = ordem.forma_pagamento === 'avista';
        const valorTotal = ordem.valor_total || 0;
        const valorParcela = Math.round((valorTotal / parcelas) * 100) / 100;

        const contas = [];
        const hoje = new Date();

        for (let i = 0; i < parcelas; i++) {
            const dataVencimento = new Date(hoje);
            dataVencimento.setDate(dataVencimento.getDate() + (30 * (i + 1))); // 30, 60, 90 dias...

            contas.push({
                ordem_compra_id: ordem.id,
                fornecedor_id: ordem.fornecedor_id,
                fornecedor_nome: ordem.fornecedor_nome,
                tipo: ordem.forma_pagamento || 'boleto',
                numero_parcela: i + 1,
                total_parcelas: parcelas,
                valor: i === parcelas - 1
                    ? Math.round((valorTotal - valorParcela * (parcelas - 1)) * 100) / 100 // última parcela ajusta centavos
                    : valorParcela,
                data_emissao: hoje.toISOString().split('T')[0],
                data_vencimento: isAvista
                    ? hoje.toISOString().split('T')[0]
                    : dataVencimento.toISOString().split('T')[0],
                status: isAvista ? 'pago' : 'pendente',
                data_pagamento: isAvista ? hoje.toISOString().split('T')[0] : null,
                numero_documento: `${ordem.numero_pedido}-P${i + 1}`,
            });
        }

        const { data, error } = await supabase
            .from('compras_contas_pagar')
            .insert(contas)
            .select();

        return handleResponse({ data, error }, 'Erro ao gerar compromissos do pedido');
    },

    // ------------------------------------------------------------------
    // ANÁLISES FINANCEIRAS
    // ------------------------------------------------------------------

    async getEndividamentoPorFornecedor() {
        const { data: contas, error } = await supabase
            .from('compras_contas_pagar')
            .select('*')
            .in('status', ['pendente', 'vencido']);

        if (error) throw error;

        const hoje = new Date().toISOString().split('T')[0];

        // Agrupar por fornecedor
        const mapa = {};
        (contas || []).forEach(c => {
            const key = c.fornecedor_id || c.fornecedor_nome || 'Desconhecido';
            if (!mapa[key]) {
                mapa[key] = {
                    fornecedor_id: c.fornecedor_id,
                    fornecedor_nome: c.fornecedor_nome || 'Desconhecido',
                    total_pendente: 0,
                    total_vencido: 0,
                    qtd_titulos: 0,
                    proximo_vencimento: null
                };
            }
            const isVencido = c.data_vencimento < hoje;
            if (isVencido) {
                mapa[key].total_vencido += Number(c.valor) || 0;
            }
            mapa[key].total_pendente += Number(c.valor) || 0;
            mapa[key].qtd_titulos += 1;

            if (!mapa[key].proximo_vencimento || c.data_vencimento < mapa[key].proximo_vencimento) {
                mapa[key].proximo_vencimento = c.data_vencimento;
            }
        });

        return Object.values(mapa).sort((a, b) => b.total_pendente - a.total_pendente);
    },

    async getEndividamentoGeral() {
        const { data: contas, error } = await supabase
            .from('compras_contas_pagar')
            .select('valor, status, data_vencimento, data_pagamento');

        if (error) throw error;

        const hoje = new Date();
        const hojeStr = hoje.toISOString().split('T')[0];
        const mesAtual = hoje.toISOString().slice(0, 7);

        const result = {
            total_pendente: 0,
            total_vencido: 0,
            total_pago_mes: 0,
            total_a_vencer_30d: 0,
            total_a_vencer_60d: 0,
            total_a_vencer_90d: 0
        };

        const d30 = new Date(hoje); d30.setDate(d30.getDate() + 30);
        const d60 = new Date(hoje); d60.setDate(d60.getDate() + 60);
        const d90 = new Date(hoje); d90.setDate(d90.getDate() + 90);

        (contas || []).forEach(c => {
            const valor = Number(c.valor) || 0;

            if (c.status === 'pago') {
                if (c.data_pagamento?.slice(0, 7) === mesAtual) {
                    result.total_pago_mes += valor;
                }
                return;
            }
            if (c.status === 'cancelado') return;

            // pendente ou vencido
            result.total_pendente += valor;

            if (c.data_vencimento < hojeStr) {
                result.total_vencido += valor;
            }

            if (c.data_vencimento <= d30.toISOString().split('T')[0]) {
                result.total_a_vencer_30d += valor;
            } else if (c.data_vencimento <= d60.toISOString().split('T')[0]) {
                result.total_a_vencer_60d += valor;
            } else if (c.data_vencimento <= d90.toISOString().split('T')[0]) {
                result.total_a_vencer_90d += valor;
            }
        });

        return result;
    },

    async getBreakEven() {
        // Buscar vendas do mês atual para calcular receita
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

        const [{ data: vendas }, { data: contas }] = await Promise.all([
            supabase
                .from('vendas')
                .select('valor_total')
                .gte('data_venda', inicioMes)
                .lte('data_venda', fimMes),
            supabase
                .from('compras_contas_pagar')
                .select('valor, status, data_vencimento')
                .in('status', ['pendente', 'vencido'])
        ]);

        const receitaMes = (vendas || []).reduce((sum, v) => sum + (Number(v.valor_total) || 0), 0);
        const compromissosMes = (contas || [])
            .filter(c => c.data_vencimento >= inicioMes && c.data_vencimento <= fimMes)
            .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
        const compromissosTotal = (contas || []).reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

        const breakEvenPercent = receitaMes > 0
            ? Math.round((compromissosMes / receitaMes) * 100)
            : compromissosMes > 0 ? 999 : 0;

        return {
            receita_mes: receitaMes,
            compromissos_mes: compromissosMes,
            compromissos_total: compromissosTotal,
            break_even_percent: breakEvenPercent, // < 100 = OK, >= 100 = Receita insuficiente
            saldo_livre: receitaMes - compromissosMes
        };
    },

    async getCapacidadeCompra() {
        const breakEven = await this.getBreakEven();
        const endGeral = await this.getEndividamentoGeral();

        // Capacidade = saldo livre - vencidos (que precisam ser pagos urgente)
        const capacidade = breakEven.saldo_livre - endGeral.total_vencido;

        let nivel = 'alta'; // verde
        if (capacidade <= 0) {
            nivel = 'critica'; // vermelho
        } else if (breakEven.break_even_percent >= 70) {
            nivel = 'atencao'; // amarelo
        }

        return {
            capacidade_valor: capacidade,
            nivel, // 'alta', 'atencao', 'critica'
            break_even: breakEven,
            endividamento: endGeral
        };
    },

    // ------------------------------------------------------------------
    // PEDIDOS POR FASE (Em Produção vs Recebidos)
    // ------------------------------------------------------------------

    async getPedidosPorFase() {
        const { data: pedidos, error } = await supabase
            .from('compras_ordens')
            .select('id, numero_pedido, fornecedor_nome, status, valor_total, data_previsao_entrega, forma_pagamento, qtd_parcelas, created_at')
            .is('deleted_at', null)
            .not('status', 'eq', 'Cancelado')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const emProducao = (pedidos || []).filter(p =>
            ['NÃO FATURADO', 'Faturado', 'Confirmado'].includes(p.status)
        );

        const recebidos = (pedidos || []).filter(p =>
            ['Recebido', 'Em Conferência', 'Parcialmente Recebido'].includes(p.status)
        );

        return { emProducao, recebidos };
    },

    // ------------------------------------------------------------------
    // VERIFICAR SE JÁ EXISTE COMPROMISSO PARA UMA ORDEM
    // ------------------------------------------------------------------

    async existeCompromisso(ordemCompraId) {
        const { count, error } = await supabase
            .from('compras_contas_pagar')
            .select('*', { count: 'exact', head: true })
            .eq('ordem_compra_id', ordemCompraId)
            .neq('status', 'cancelado');

        if (error) return false;
        return (count || 0) > 0;
    }
};
