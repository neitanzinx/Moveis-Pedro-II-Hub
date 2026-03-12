import { supabase } from '../lib/supabase';
import { ApprovalEngine } from './ApprovalEngine';
import { comprasFinanceiroService } from './comprasFinanceiroService';

// Helper function to handle Supabase errors consistently
const handleResponse = ({ data, error }, customMessage) => {
    if (error) {
        console.error(`Error in comprasService: ${customMessage}`, error);
        throw new Error(error.message);
    }
    return data;
};

export const comprasService = {
    // ------------------------------------------------------------------
    // METADATA / CONFIGURATIONS
    // ------------------------------------------------------------------

    async getCentrosCusto(tipo = null) {
        let query = supabase
            .from('compras_centro_custos')
            .select('*')
            .eq('ativo', true)
            .order('ordem_index');

        if (tipo) {
            query = query.eq('tipo', tipo);
        }

        return handleResponse(await query, 'fetching centros de custo');
    },

    async getWorkflows() {
        // Agora as colunas do Kanban são baseadas nesta tabela que sincroniza com Centros de Custo
        return handleResponse(
            await supabase
                .from('compras_workflows')
                .select(`
                    *,
                    centro_custo:centro_custo_id (id, nome, cor, tipo)
                `)
                .eq('ativo', true)
                .order('ordem_index'),
            'fetching kanban columns'
        );
    },

    // ------------------------------------------------------------------
    // PURCHASE ORDERS (ORDENS DE COMPRA)
    // ------------------------------------------------------------------

    async getBoard() {
        // Status priority map for sorting (Swimlanes)
        const statusPriority = {
            'NÃO FATURADO': 1,
            'APROVADO': 2,
            'CONFIRMADO': 3,
            'COM PREVISÃO DE CHEGADA': 4,
            'EM TRANSPORTE': 5,
            'ENTREGUE': 6,
            'Cancelado': 99
        };

        // Get dynamic columns (Workflows linked to Cost Centers)
        const columns = await this.getWorkflows();

        // Get active cards with their status labels and center costs
        const cards = handleResponse(
            await supabase
                .from('compras_ordens')
                .select(`
                    *,
                    centro_custo:centro_custo_id (id, nome, cor, tipo),
                    fornecedor:fornecedor_id (id, nome),
                    itens:compras_oc_itens (id, produto_nome, quantidade_pedida)
                `)
                .is('deleted_at', null)
                .order('updated_at', { ascending: false }),
            'fetching board cards'
        );

        // Sort cards by status priority, then by update date
        const sortedCards = [...cards].sort((a, b) => {
            const pA = statusPriority[a.status] || 50;
            const pB = statusPriority[b.status] || 50;
            if (pA !== pB) return pA - pB;
            return new Date(b.updated_at) - new Date(a.updated_at);
        });

        // Group cards by their Cost Center Column
        const board = columns.map(col => ({
            ...col,
            cards: sortedCards.filter(card => card.centro_custo_id === col.centro_custo_id)
        }));

        return { columns, cards: sortedCards, board };
    },

    async getOrdens(options = {}) {
        const { limit = 100, status } = options;
        let query = supabase
            .from('compras_ordens')
            .select(`
                *,
                centro_custo:centro_custo_id (id, nome, cor),
                fornecedor:fornecedor_id (id, nome)
            `)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (limit) {
            query = query.limit(limit);
        }

        return handleResponse(await query, 'fetching ordens');
    },

    async getOrdemById(id) {
        return handleResponse(
            await supabase
                .from('compras_ordens')
                .select(`
          *,
          centro_custo:centro_custo_id (id, nome, cor),
          fornecedor:fornecedor_id (id, nome),
          itens:compras_oc_itens (*),
          comunicacoes:compras_comunicacoes (*),
          aprovacoes:compras_aprovacoes (*, user:user_id(email, raw_user_meta_data)),
          aprovacoes_novas:aprovacoes_oc (*, user:aprovador_id(email, raw_user_meta_data))
        `)
                .eq('id', id)
                .single(),
            `fetching ordem ${id}`
        );
    },

    async createOrdem(ordemData, itensData = []) {
        // 1. Create the main O.C.
        const novaOrdem = handleResponse(
            await supabase
                .from('compras_ordens')
                .insert([ordemData])
                .select()
                .single(),
            'creating ordem'
        );

        // 2. Create the associated items (if any)
        if (itensData.length > 0) {
            const itensToInsert = itensData.map(item => ({
                ...item,
                ordem_compra_id: novaOrdem.id
            }));

            handleResponse(
                await supabase
                    .from('compras_oc_itens')
                    .insert(itensToInsert),
                'creating ordem itens'
            );
        }

        // 3. Start Approval Flow
        await ApprovalEngine.startApprovalFlow(novaOrdem.id, novaOrdem.valor_total, itensData);

        return novaOrdem;
    },

    async updateOrdem(id, updateData) {
        updateData.updated_at = new Date().toISOString();
        return handleResponse(
            await supabase
                .from('compras_ordens')
                .update(updateData)
                .eq('id', id)
                .select()
                .single(),
            `updating ordem ${id}`
        );
    },

    async moveCard(ordemId, newCentroCustoId) {
        // No novo modelo, mover entre colunas altera o CENTRO DE CUSTO (Vendedor/Setor)
        return this.updateOrdem(ordemId, {
            centro_custo_id: newCentroCustoId,
            updated_at: new Date().toISOString()
        });
    },

    async updateStatus(ordemId, newStatusLabel) {
        // Altera apenas o label visual de status (Não faturado, aprovado, etc)
        const result = await this.updateOrdem(ordemId, {
            status: newStatusLabel,
            updated_at: new Date().toISOString()
        });

        // Auto-gerar compromissos financeiros quando pedido é recebido
        if (newStatusLabel === 'Recebido') {
            try {
                const jaExiste = await comprasFinanceiroService.existeCompromisso(ordemId);
                if (!jaExiste) {
                    const ordem = await this.getOrdemById(ordemId);
                    if (ordem) {
                        const parcelas = ordem.qtd_parcelas || 1;
                        await comprasFinanceiroService.gerarCompromissoPedido(ordem, parcelas);
                    }
                }
            } catch (err) {
                console.error('Erro ao gerar compromisso financeiro:', err);
                // Não bloqueia a atualização de status
            }
        }

        return result;
    },

    async softDeleteOrdem(id) {
        return handleResponse(
            await supabase
                .from('compras_ordens')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id),
            `soft deleting ordem ${id}`
        );
    },

    // ------------------------------------------------------------------
    // COMMUNICATIONS & APPROVALS
    // ------------------------------------------------------------------

    async addComunicacao(comunicacaoData) {
        return handleResponse(
            await supabase
                .from('compras_comunicacoes')
                .insert([comunicacaoData])
                .select()
                .single(),
            'adding comunicacao'
        );
    },

    async getComunicacaoHistorico(ordemCompraId) {
        return handleResponse(
            await supabase
                .from('compras_comunicacoes_historico')
                .select(`
                    *,
                    usuario:usuario_id (email)
                `)
                .eq('ordem_compra_id', ordemCompraId)
                .order('created_at', { ascending: false }),
            `fetching communication history for OC ${ordemCompraId}`
        );
    },

    async logComunicacaoChange(ordemCompraId, campo, valorAntigo, valorNovo, usuarioId) {
        return handleResponse(
            await supabase
                .from('compras_comunicacoes_historico')
                .insert([{
                    ordem_compra_id: ordemCompraId,
                    campo,
                    valor_antigo: valorAntigo?.toString(),
                    valor_novo: valorNovo?.toString(),
                    usuario_id: usuarioId
                }]),
            `logging communication change for OC ${ordemCompraId}`
        );
    },

    // --- MARKUP CONFIGS ---

    async getMarkupConfig(fornecedorId) {
        const { data, error } = await supabase
            .from('compras_markup_configs')
            .select('*')
            .eq('fornecedor_id', fornecedorId)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching markup config', error);
            return null;
        }
        return data;
    },

    async saveMarkupConfig(config) {
        const { id, ...data } = config;
        if (id) {
            return handleResponse(
                await supabase
                    .from('compras_markup_configs')
                    .update(data)
                    .eq('id', id)
                    .select()
                    .single(),
                'updating markup config'
            );
        } else {
            return handleResponse(
                await supabase
                    .from('compras_markup_configs')
                    .insert([data])
                    .select()
                    .single(),
                'creating markup config'
            );
        }
    },

    calcularPrecoVenda(custo, config, valorPedido = 0) {
        if (!config || !config.regras) {
            return {
                custoOriginal: custo,
                custoAposRegras: custo,
                precoVenda: custo,
                detalhamento: ['Nenhuma regra de markup configurada']
            };
        }

        let base = custo;
        const detalhamento = [];

        // Aplica sequência de regras
        for (const regra of config.regras) {
            const fator = regra.tipo === 'desconto' ? -1 : 1;
            const valorAnterior = base;
            base = base * (1 + (fator * regra.valor / 100));
            detalhamento.push(`${regra.descricao}: R$ ${valorAnterior.toFixed(2)} → R$ ${base.toFixed(2)} (${regra.tipo === 'desconto' ? '-' : '+'}${regra.valor}%)`);
        }

        // Verifica bônus por valor
        if (config.bonus_valor && valorPedido > (config.bonus_valor.minimo || 0)) {
            const valorAnterior = base;
            base = base * (1 - (config.bonus_valor.desconto_extra || 0) / 100);
            detalhamento.push(`Bônus valor (> R$ ${config.bonus_valor.minimo}): R$ ${valorAnterior.toFixed(2)} → R$ ${base.toFixed(2)} (-${config.bonus_valor.desconto_extra}%)`);
        }

        const precoVenda = base * (config.multiplicador_final || 1);
        detalhamento.push(`Multiplicador final: x${config.multiplicador_final || 1} → Preço de Venda: R$ ${precoVenda.toFixed(2)}`);

        return {
            custoOriginal: custo,
            custoAposRegras: base,
            precoVenda: Math.round(precoVenda * 100) / 100,
            detalhamento
        };
    },

    // --- APPROVALS ---

    async getAprovacoesDaOrdem(ordemId) {
        return handleResponse(
            await supabase
                .from('compras_aprovacoes')
                .select(`
                    id, 
                    status, 
                    comentarios, 
                    created_at, 
                    processed_at,
                    user_id,
                    users:public_users!compras_aprovacoes_user_id_fkey(full_name, avatar_url)
                `)
                .eq('ordem_compra_id', ordemId)
                .order('created_at', { ascending: false }),
            `fetching approvals for ordem ${ordemId}`
        );
    },

    async requestApproval(ordemId, userId) {
        return handleResponse(
            await supabase
                .from('compras_aprovacoes')
                .insert([{
                    ordem_compra_id: ordemId,
                    user_id: userId,
                    status: 'pendente'
                }])
                .select()
                .single(),
            `requesting approval for ordem ${ordemId}`
        );
    },

    async respondApproval(aprovacaoId, status, comentarios) {
        return handleResponse(
            await supabase
                .from('compras_aprovacoes')
                .update({
                    status,
                    comentarios,
                    processed_at: new Date().toISOString()
                })
                .eq('id', aprovacaoId)
                .select()
                .single(),
            `responding to approval ${aprovacaoId}`
        );
    },

    // --- SELLER / CENTER COST MANAGEMENT ---

    async upsertCentroCusto(ccData) {
        let response;
        if (ccData.id) {
            response = await supabase
                .from('compras_centro_custos')
                .update(ccData)
                .eq('id', ccData.id)
                .select()
                .single();
        } else {
            response = await supabase
                .from('compras_centro_custos')
                .insert([ccData])
                .select()
                .single();
        }

        const data = handleResponse(response, 'saving centro de custo');

        // Sync workflow column automatically
        await this.syncWorkflowColumn(data);

        return data;
    },

    async syncWorkflowColumn(cc) {
        // Checks if a column exists for this center cost, if not, create it
        const { data: existing } = await supabase
            .from('compras_workflows')
            .select('id')
            .eq('centro_custo_id', cc.id)
            .single();

        const nomeColuna = cc.tipo === 'vendedor' ? `ENCOMENDAS DE CLIENTES - ${cc.nome}` : cc.nome;

        if (existing) {
            return await supabase
                .from('compras_workflows')
                .update({
                    nome: nomeColuna,
                    tipo: cc.tipo,
                    ativo: cc.ativo,
                    ordem_index: cc.ordem_index
                })
                .eq('id', existing.id);
        } else {
            return await supabase
                .from('compras_workflows')
                .insert([{
                    centro_custo_id: cc.id,
                    nome: nomeColuna,
                    tipo: cc.tipo,
                    ordem_index: cc.ordem_index,
                    ativo: cc.ativo
                }]);
        }
    }
};
