-- Supabase Database Schema for Furniture Store ERP System
-- Generated based on codebase analysis

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: public_users (linked to auth.users)
CREATE TABLE public_users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    nome text,
    cargo text,
    loja text,
    avatar_url text,
    created_at timestamptz DEFAULT now()
);

-- Table: cargos
CREATE TABLE cargos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    permissoes jsonb,
    created_at timestamptz DEFAULT now()
);

-- Table: lojas
CREATE TABLE lojas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    endereco text,
    ativa boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Table: cupons
CREATE TABLE cupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text UNIQUE NOT NULL,
    tipo text CHECK (tipo IN ('porcentagem', 'fixo')),
    valor numeric(10,2) NOT NULL,
    validade date,
    quantidade_disponivel integer,
    quantidade_usada integer DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Table: fornecedores
CREATE TABLE fornecedores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_empresa text NOT NULL,
    cnpj text UNIQUE,
    contato text,
    nome text,
    telefone text,
    email text,
    created_at timestamptz DEFAULT now()
);

-- Table: produtos
CREATE TABLE produtos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    preco_custo numeric(10,2),
    preco_venda numeric(10,2),
    quantidade_estoque integer DEFAULT 0,
    fornecedor_id uuid REFERENCES fornecedores(id),
    categoria text,
    codigo_barras text UNIQUE,
    estoque_minimo integer DEFAULT 0,
    ativo boolean DEFAULT true,
    ambiente text,
    largura numeric(10,2),
    altura numeric(10,2),
    profundidade numeric(10,2),
    material text,
    cor text,
    tags text[],
    variacoes jsonb,
    fotos jsonb,
    fornecedor_nome text,
    created_at timestamptz DEFAULT now()
);

-- Table: clientes
CREATE TABLE clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo text NOT NULL,
    tipo_pessoa text CHECK (tipo_pessoa IN ('PF', 'PJ')),
    cpf text,
    cnpj text,
    razao_social text,
    telefone text,
    email text,
    cep text,
    endereco text,
    numero text,
    complemento text,
    bairro text,
    cidade text,
    estado text,
    contatos jsonb,
    enderecos jsonb,
    observacoes text,
    data_nascimento date,
    created_by uuid REFERENCES public_users(id),
    created_at timestamptz DEFAULT now()
);

-- Table: vendedores
CREATE TABLE vendedores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    ativo boolean DEFAULT true,
    loja text,
    created_at timestamptz DEFAULT now()
);

-- Table: vendas
CREATE TABLE vendas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid REFERENCES clientes(id),
    responsavel_id uuid REFERENCES public_users(id),
    status text,
    data_venda date,
    itens jsonb,
    desconto numeric(10,2),
    observacoes text,
    loja text,
    numero_pedido text UNIQUE,
    pagamentos jsonb,
    valor_pago numeric(10,2),
    valor_restante numeric(10,2),
    pagamento_na_entrega boolean DEFAULT false,
    prazo_entrega date,
    responsavel_nome text,
    cliente_nome text,
    cliente_telefone text,
    valor_pagamento_entrega numeric(10,2),
    forma_pagamento_entrega text,
    valor_total numeric(10,2),
    created_at timestamptz DEFAULT now()
);

-- Table: orcamentos
CREATE TABLE orcamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid REFERENCES clientes(id),
    itens jsonb,
    valor_total numeric(10,2),
    validade date,
    numero_orcamento text UNIQUE,
    data_orcamento date,
    loja text,
    cliente_nome text,
    cliente_telefone text,
    desconto numeric(10,2),
    status text,
    observacoes text,
    created_at timestamptz DEFAULT now()
);

-- Table: caminhoes
CREATE TABLE caminhoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    placa text UNIQUE NOT NULL,
    modelo text,
    motorista_nome text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    ultima_atualizacao timestamptz,
    status_rota text,
    motorista_padrao uuid,
    status text,
    created_at timestamptz DEFAULT now()
);

-- Table: colaboradores
CREATE TABLE colaboradores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo text NOT NULL,
    cargo text,
    setor text,
    status text,
    data_admissao date,
    created_at timestamptz DEFAULT now()
);

-- Add foreign key for caminhoes.motorista_padrao
ALTER TABLE caminhoes ADD CONSTRAINT fk_caminhoes_motorista_padrao FOREIGN KEY (motorista_padrao) REFERENCES colaboradores(id);

-- Table: entregas
CREATE TABLE entregas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id uuid REFERENCES vendas(id),
    endereco_entrega text,
    data_agendada date,
    status text,
    caminhao_id uuid REFERENCES caminhoes(id),
    impresso boolean DEFAULT false,
    data_impressao timestamptz,
    ordem_rota integer,
    data_realizada date,
    numero_pedido text,
    cliente_nome text,
    cliente_telefone text,
    data_limite date,
    turno text,
    status_confirmacao text,
    entregador_id uuid REFERENCES colaboradores(id),
    observacoes text,
    created_at timestamptz DEFAULT now()
);

-- Table: devolucoes
CREATE TABLE devolucoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id uuid REFERENCES vendas(id),
    produto_nome text,
    motivo text,
    status text,
    data_solicitacao date,
    resolucao text,
    created_at timestamptz DEFAULT now()
);

-- Table: montagens
CREATE TABLE montagens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id uuid REFERENCES vendas(id),
    montador_nome text,
    data_agendada date,
    status text,
    valor_montagem numeric(10,2),
    cliente_nome text,
    montador_id uuid REFERENCES colaboradores(id),
    created_at timestamptz DEFAULT now()
);

-- Table: valores_montagem
CREATE TABLE valores_montagem (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modelo_movel text NOT NULL,
    valor numeric(10,2),
    created_at timestamptz DEFAULT now()
);

-- Table: configuracao_comissoes
CREATE TABLE configuracao_comissoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    forma_pagamento text,
    porcentagem numeric(5,2),
    descricao text,
    updated_at timestamptz DEFAULT now()
);

-- Table: categorias_financeiras
CREATE TABLE categorias_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text,
    cor text,
    ativa boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Table: lancamentos_financeiros
CREATE TABLE lancamentos_financeiros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    descricao text,
    valor numeric(10,2),
    tipo text,
    data_vencimento date,
    pago boolean DEFAULT false,
    categoria_id uuid REFERENCES categorias_financeiras(id),
    categoria_nome text,
    forma_pagamento text,
    status text,
    anexo_url text,
    observacao text,
    recorrente boolean DEFAULT false,
    recorrencia_tipo text,
    data_lancamento date,
    created_at timestamptz DEFAULT now()
);

-- Table: audit_logs
CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    acao text,
    usuario text,
    detalhes jsonb,
    user_id uuid REFERENCES public_users(id),
    tabela text,
    created_at timestamptz DEFAULT now()
);

-- Table: ferias
CREATE TABLE ferias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id uuid REFERENCES colaboradores(id),
    colaborador_nome text,
    data_inicio date,
    data_fim date,
    quantidade_dias integer,
    status text,
    created_at timestamptz DEFAULT now()
);

-- Table: licencas
CREATE TABLE licencas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id uuid REFERENCES colaboradores(id),
    colaborador_nome text,
    tipo text,
    data_inicio date,
    data_fim date,
    status text,
    created_at timestamptz DEFAULT now()
);

-- Table: vagas
CREATE TABLE vagas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text,
    cargo text,
    setor text,
    quantidade_vagas integer,
    status text,
    data_abertura date,
    created_at timestamptz DEFAULT now()
);

-- Table: candidatos
CREATE TABLE candidatos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo text,
    email text,
    telefone text,
    vaga_id uuid REFERENCES vagas(id),
    vaga_titulo text,
    etapa_atual text,
    status text,
    curriculo_url text,
    created_at timestamptz DEFAULT now()
);

-- Table: comunicados_rh
CREATE TABLE comunicados_rh (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text,
    conteudo text,
    autor_nome text,
    tipo text,
    publicado boolean DEFAULT false,
    data_publicacao timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Table: transferencias_estoque
CREATE TABLE transferencias_estoque (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_nome text,
    origem text,
    destino text,
    quantidade integer,
    status text,
    produto_id uuid REFERENCES produtos(id),
    created_at timestamptz DEFAULT now()
);

-- Table: inventarios
CREATE TABLE inventarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data_inventario date,
    responsavel text,
    status text,
    itens_contados jsonb,
    observacoes text,
    data_realizacao date,
    created_at timestamptz DEFAULT now()
);

-- Table: alertas_recompra
CREATE TABLE alertas_recompra (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id uuid REFERENCES produtos(id),
    mensagem text,
    lido boolean DEFAULT false,
    status text,
    created_at timestamptz DEFAULT now()
);

-- Table: notificacoes
CREATE TABLE notificacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text,
    mensagem text,
    lida boolean DEFAULT false,
    destinatario_id uuid REFERENCES public_users(id),
    tipo text,
    created_at timestamptz DEFAULT now()
);

-- Table: mensagens_chat
CREATE TABLE mensagens_chat (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    remetente_id uuid REFERENCES public_users(id),
    remetente_nome text,
    conteudo text,
    canal text,
    created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_produtos_fornecedor_id ON produtos(fornecedor_id);
CREATE INDEX idx_produtos_categoria ON produtos(categoria);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);
CREATE INDEX idx_produtos_codigo_barras ON produtos(codigo_barras);

CREATE INDEX idx_clientes_tipo_pessoa ON clientes(tipo_pessoa);
CREATE INDEX idx_clientes_cpf ON clientes(cpf);
CREATE INDEX idx_clientes_cnpj ON clientes(cnpj);
CREATE INDEX idx_clientes_created_by ON clientes(created_by);

CREATE INDEX idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX idx_vendas_responsavel_id ON vendas(responsavel_id);
CREATE INDEX idx_vendas_status ON vendas(status);
CREATE INDEX idx_vendas_data_venda ON vendas(data_venda);
CREATE INDEX idx_vendas_loja ON vendas(loja);
CREATE INDEX idx_vendas_numero_pedido ON vendas(numero_pedido);

CREATE INDEX idx_orcamentos_cliente_id ON orcamentos(cliente_id);
CREATE INDEX idx_orcamentos_status ON orcamentos(status);
CREATE INDEX idx_orcamentos_data_orcamento ON orcamentos(data_orcamento);
CREATE INDEX idx_orcamentos_loja ON orcamentos(loja);
CREATE INDEX idx_orcamentos_numero_orcamento ON orcamentos(numero_orcamento);

CREATE INDEX idx_entregas_venda_id ON entregas(venda_id);
CREATE INDEX idx_entregas_status ON entregas(status);
CREATE INDEX idx_entregas_data_agendada ON entregas(data_agendada);
CREATE INDEX idx_entregas_caminhao_id ON entregas(caminhao_id);
CREATE INDEX idx_entregas_entregador_id ON entregas(entregador_id);

CREATE INDEX idx_devolucoes_venda_id ON devolucoes(venda_id);
CREATE INDEX idx_devolucoes_status ON devolucoes(status);

CREATE INDEX idx_montagens_venda_id ON montagens(venda_id);
CREATE INDEX idx_montagens_status ON montagens(status);
CREATE INDEX idx_montagens_montador_id ON montagens(montador_id);

CREATE INDEX idx_lancamentos_financeiros_categoria_id ON lancamentos_financeiros(categoria_id);
CREATE INDEX idx_lancamentos_financeiros_tipo ON lancamentos_financeiros(tipo);
CREATE INDEX idx_lancamentos_financeiros_status ON lancamentos_financeiros(status);
CREATE INDEX idx_lancamentos_financeiros_data_vencimento ON lancamentos_financeiros(data_vencimento);
CREATE INDEX idx_lancamentos_financeiros_pago ON lancamentos_financeiros(pago);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_tabela ON audit_logs(tabela);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_ferias_colaborador_id ON ferias(colaborador_id);
CREATE INDEX idx_ferias_status ON ferias(status);

CREATE INDEX idx_licencas_colaborador_id ON licencas(colaborador_id);
CREATE INDEX idx_licencas_status ON licencas(status);

CREATE INDEX idx_candidatos_vaga_id ON candidatos(vaga_id);
CREATE INDEX idx_candidatos_status ON candidatos(status);

CREATE INDEX idx_transferencias_estoque_produto_id ON transferencias_estoque(produto_id);
CREATE INDEX idx_transferencias_estoque_status ON transferencias_estoque(status);

CREATE INDEX idx_inventarios_status ON inventarios(status);
CREATE INDEX idx_inventarios_data_inventario ON inventarios(data_inventario);

CREATE INDEX idx_alertas_recompra_produto_id ON alertas_recompra(produto_id);
CREATE INDEX idx_alertas_recompra_lido ON alertas_recompra(lido);
CREATE INDEX idx_alertas_recompra_status ON alertas_recompra(status);

CREATE INDEX idx_notificacoes_destinatario_id ON notificacoes(destinatario_id);
CREATE INDEX idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX idx_notificacoes_tipo ON notificacoes(tipo);

CREATE INDEX idx_mensagens_chat_remetente_id ON mensagens_chat(remetente_id);
CREATE INDEX idx_mensagens_chat_canal ON mensagens_chat(canal);

CREATE INDEX idx_vendedores_loja ON vendedores(loja);
CREATE INDEX idx_vendedores_ativo ON vendedores(ativo);

CREATE INDEX idx_caminhoes_motorista_padrao ON caminhoes(motorista_padrao);
CREATE INDEX idx_caminhoes_status ON caminhoes(status);

CREATE INDEX idx_colaboradores_status ON colaboradores(status);

-- Row Level Security (RLS) Policies
-- Enable RLS on tables with multi-tenant data (based on loja)

ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendas_policy ON vendas
    FOR ALL USING (loja = (SELECT loja FROM public_users WHERE id = auth.uid()));

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY orcamentos_policy ON orcamentos
    FOR ALL USING (loja = (SELECT loja FROM public_users WHERE id = auth.uid()));

ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendedores_policy ON vendedores
    FOR ALL USING (loja = (SELECT loja FROM public_users WHERE id = auth.uid()));

-- For tables without loja, allow access based on user existence or specific rules
ALTER TABLE public_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_users_policy ON public_users
    FOR ALL USING (id = auth.uid());

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificacoes_policy ON notificacoes
    FOR ALL USING (destinatario_id = auth.uid());

ALTER TABLE mensagens_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY mensagens_chat_policy ON mensagens_chat
    FOR ALL USING (remetente_id = auth.uid() OR canal IN ('public', 'general'));

-- For shared tables like produtos, fornecedores, clientes, allow read for all authenticated users, but restrict writes
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY produtos_read_policy ON produtos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY produtos_write_policy ON produtos FOR ALL USING (auth.role() = 'authenticated'); -- Adjust based on permissions

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY fornecedores_read_policy ON fornecedores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY fornecedores_write_policy ON fornecedores FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_read_policy ON clientes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY clientes_write_policy ON clientes FOR ALL USING (auth.role() = 'authenticated');

-- Similar for other shared tables
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY entregas_policy ON entregas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE devolucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY devolucoes_policy ON devolucoes FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE montagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY montagens_policy ON montagens FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY lancamentos_financeiros_policy ON lancamentos_financeiros FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_financeiras_policy ON categorias_financeiras FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_policy ON audit_logs FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY colaboradores_policy ON colaboradores FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;
CREATE POLICY ferias_policy ON ferias FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE licencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY licencas_policy ON licencas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
CREATE POLICY vagas_policy ON vagas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidatos_policy ON candidatos FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE comunicados_rh ENABLE ROW LEVEL SECURITY;
CREATE POLICY comunicados_rh_policy ON comunicados_rh FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE transferencias_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY transferencias_estoque_policy ON transferencias_estoque FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventarios_policy ON inventarios FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE alertas_recompra ENABLE ROW LEVEL SECURITY;
CREATE POLICY alertas_recompra_policy ON alertas_recompra FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE caminhoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY caminhoes_policy ON caminhoes FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE valores_montagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY valores_montagem_policy ON valores_montagem FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE configuracao_comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY configuracao_comissoes_policy ON configuracao_comissoes FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargos_policy ON cargos FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;
CREATE POLICY lojas_policy ON lojas FOR ALL USING (auth.role() = 'authenticated');