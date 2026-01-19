import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

// Mapa Completo: Entidade (Código) -> Tabela (Supabase)
const tableMap = {
    Campanha: 'campanhas',
    Cupom: 'cupons',
    Loja: 'lojas',
    Produto: 'produtos',
    Cliente: 'clientes',
    Venda: 'vendas',
    Entrega: 'entregas',
    Fornecedor: 'fornecedores',
    Orcamento: 'orcamentos',
    Devolucao: 'devolucoes',
    Parcela: 'parcelas',
    Vendedor: 'vendedores',
    ConfiguracaoComissao: 'configuracao_comissoes',
    AuditLog: 'audit_logs',
    LancamentoFinanceiro: 'lancamentos_financeiros',
    CategoriaFinanceira: 'categorias_financeiras',
    Montagem: 'montagens',
    ValorMontagem: 'valores_montagem',
    Colaborador: 'colaboradores',
    FolhaPagamento: 'folhas_pagamento',
    Ferias: 'ferias',
    Licenca: 'licencas',
    Vaga: 'vagas',
    Candidato: 'candidatos',
    AvaliacaoDesempenho: 'avaliacoes_desempenho',
    DocumentoRH: 'documentos_rh',
    ComunicadoRH: 'comunicados_rh',
    PontoEletronico: 'ponto_eletronico',
    TransferenciaEstoque: 'transferencias_estoque',
    Inventario: 'inventarios',
    AlertaRecompra: 'alertas_recompra',
    Caminhao: 'caminhoes',
    Notificacao: 'notificacoes',
    MensagemChat: 'mensagens_chat',
    Cargo: 'cargos',
    User: 'public_users',
    ConfiguracaoTaxa: 'configuracao_taxas',
    Montador: 'montadores',
    MontagemItem: 'montagens_itens',
    NotaFiscalEntrada: 'notas_fiscais_entrada',
    ItemNotaFiscal: 'itens_nota_fiscal',
    NotaFiscalEmitida: 'notas_fiscais_emitidas',
    ItemNfeEmitida: 'itens_nfe_emitida',
    AssistenciaTecnica: 'assistencias_tecnicas',
    PedidoCompra: 'pedidos_compra',
    ItemPedidoCompra: 'itens_pedido_compra',
    CobrancaPix: 'cobrancas_pix',
    ConfiguracaoSistema: 'configuracoes_sistema',
    RolePermission: 'role_permissions',
    NPSLink: 'nps_links',
    NPSAvaliacao: 'nps_avaliacoes',
    MetaVenda: 'metas_vendas',
    TokenGerencial: 'tokens_gerenciais',
    LogUsoToken: 'log_uso_tokens',
    PedidoMostruario: 'pedidos_mostruario',
    SolicitacaoCadastro: 'solicitacoes_cadastro_produto',
    PromocaoFornecedor: 'promocoes_fornecedor'
};

// O Adaptador Mágico (Handler)
const createHandler = (tableName) => ({
    list: async (orderBy = null) => {
        let query = supabase.from(tableName).select('*');
        if (orderBy && typeof orderBy === 'string') {
            const isDesc = orderBy.startsWith('-');
            const field = isDesc ? orderBy.substring(1) : orderBy;
            const dbField = field === 'created_date' ? 'created_at' : field;
            query = query.order(dbField, { ascending: !isDesc });
        }
        const { data, error } = await query;
        if (error) {
            console.error(`Erro Supabase (Listar ${tableName}):`, error);
            throw error;
        }
        return data || [];
    },
    create: async (data) => {
        const { data: created, error } = await supabase.from(tableName).insert(data).select().single();
        if (error) {
            console.error(`Erro Supabase (Criar em ${tableName}):`, error);
            throw error;
        }
        return created;
    },
    update: async (id, data) => {
        const { data: updated, error } = await supabase.from(tableName).update(data).eq('id', id).select().single();
        if (error) {
            console.error(`Erro Supabase (Atualizar ${id} em ${tableName}):`, error, 'Dados enviados:', data);
            throw error;
        }
        return updated;
    },
    delete: async (id) => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) {
            console.error(`Erro Supabase (Deletar ${id} em ${tableName}):`, error);
            throw error;
        }
        return true;
    },
    filter: async (filters, orderBy = null) => {
        let query = supabase.from(tableName).select('*');

        // Aplicar filtros
        if (filters && typeof filters === 'object') {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            });
        }

        // Aplicar ordenação
        if (orderBy && typeof orderBy === 'string') {
            const isDesc = orderBy.startsWith('-');
            const field = isDesc ? orderBy.substring(1) : orderBy;
            const dbField = field === 'created_date' ? 'created_at' : field;
            query = query.order(dbField, { ascending: !isDesc });
        }

        const { data, error } = await query;
        if (error) {
            console.error(`Erro Supabase (Filtrar ${tableName}):`, error);
            throw error;
        }
        return data || [];
    }
});

// Objeto base44 (Proxy) - mantido para compatibilidade
export const base44 = {
    entities: new Proxy({}, {
        get: (target, prop) => {
            const tableName = tableMap[prop];
            if (!tableName) {
                // Entidade não mapeada - usando plural automático
                return createHandler(prop.toLowerCase() + 's');
            }
            return createHandler(tableName);
        }
    }),

    // Autenticação (Adaptado para Supabase Auth)
    auth: {
        me: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data: profile } = await supabase.from('public_users').select('*').eq('id', user.id).single();
            return { ...user, ...profile };
        },

        // Atualizar dados do usuário logado
        updateMe: async (data) => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');
            const { data: updated, error } = await supabase
                .from('public_users')
                .update(data)
                .eq('id', user.id)
                .select()
                .single();
            if (error) throw error;
            return updated;
        },

        signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
        login: (email, password) => supabase.auth.signInWithPassword({ email, password }),

        signUp: async ({ email, password }) => await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: window.location.origin
            }
        }),

        signOut: () => supabase.auth.signOut(),
        logout: () => supabase.auth.signOut(),

        onAuthStateChange: (callback) => supabase.auth.onAuthStateChange(callback),
    },

    integrations: {
        Core: {
            UploadFile: async ({ file }) => {
                const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                const { error } = await supabase.storage.from('publico').upload(fileName, file);
                if (error) throw error;
                const { data: { publicUrl } } = supabase.storage.from('publico').getPublicUrl(fileName);
                return { file_url: publicUrl };
            },
            InvokeLLM: async () => {
                // IA desativada
                return null;
            }
        }
    }
};

// Exportar tableMap para uso externo se necessário
export { tableMap };
