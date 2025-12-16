import { createClient } from '@supabase/supabase-js';

// 1. Configuração do Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Mapa Completo: Entidade (Código) -> Tabela (Supabase)
const tableMap = {
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
  TransferenciaEstoque: 'transferencias_estoque',
  Inventario: 'inventarios',
  AlertaRecompra: 'alertas_recompra',
  Caminhao: 'caminhoes',
  Notificacao: 'notificacoes',
  MensagemChat: 'mensagens_chat',
  Cargo: 'cargos',
  User: 'public_users' 
};

// 3. O Adaptador Mágico (Handler)
const createHandler = (tableName) => ({
  list: async (orderBy = 'created_at') => {
    let query = supabase.from(tableName).select('*');
    if (typeof orderBy === 'string') {
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
        console.error(`Erro Supabase (Atualizar ${id} em ${tableName}):`, error);
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
  }
});

// 4. Objeto base44 Falso (Proxy)
export const base44 = {
  entities: new Proxy({}, {
    get: (target, prop) => {
      const tableName = tableMap[prop];
      if (!tableName) {
        console.warn(`⚠️ Entidade '${prop}' não mapeada explicitamente. Usando plural automático.`);
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
    // --- CORREÇÃO AQUI: Adicionado os "aliases" para compatibilidade ---
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    login: (email, password) => supabase.auth.signInWithPassword({ email, password }), // Alias login -> signIn
    
    signOut: () => supabase.auth.signOut(),
    logout: () => supabase.auth.signOut(), // Alias logout -> signOut
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
            console.warn("⚠️ IA (InvokeLLM) desativada.");
            return null;
        }
    }
  }
};