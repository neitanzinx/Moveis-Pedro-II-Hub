-- ==========================================================
-- FINAL DATABASE SETUP: Setor de Compras (Kanban)
-- Versão 2.2 - Harmonização de Campos e Nomenclatura
-- ==========================================================

-- 1. Centro de Custos (Vendedores e Setores)
CREATE TABLE IF NOT EXISTS compras_centro_custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cor VARCHAR DEFAULT '#94a3b8',
  tipo VARCHAR DEFAULT 'vendedor',
  ordem_index INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE compras_centro_custos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_centro_custos ON compras_centro_custos;
CREATE POLICY all_compras_centro_custos ON compras_centro_custos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Colunas do Kanban
CREATE TABLE IF NOT EXISTS compras_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo_id UUID REFERENCES compras_centro_custos(id) ON DELETE SET NULL,
  nome VARCHAR NOT NULL,
  tipo VARCHAR DEFAULT 'vendedor',
  ordem_index INT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_workflows ON compras_workflows;
CREATE POLICY all_compras_workflows ON compras_workflows 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Ordens de Compra (Cards)
CREATE TABLE IF NOT EXISTS compras_ordens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido VARCHAR NOT NULL,
  centro_custo_id UUID REFERENCES compras_centro_custos(id),
  tipo VARCHAR DEFAULT 'cliente',
  fornecedor_id BIGINT REFERENCES fornecedores(id), 
  fornecedor_nome VARCHAR,
  status VARCHAR DEFAULT 'NÃO FATURADO', 
  prioridade VARCHAR DEFAULT 'normal',
  tipo_preco VARCHAR DEFAULT 'normal',
  valor_total NUMERIC(15,2) DEFAULT 0.00,
  valor_frete NUMERIC(15,2) DEFAULT 0.00,
  valor_desconto NUMERIC(15,2) DEFAULT 0.00,
  economia_total NUMERIC(15,2) DEFAULT 0.00,
  promocao_observacao TEXT,
  condicoes_pagamento VARCHAR,
  data_pedido DATE DEFAULT CURRENT_DATE,
  data_previsao_entrega DATE,
  prazo_aprovacao DATE,
  devolutiva TEXT, 
  quem_aceitou VARCHAR, 
  tipo_comunicacao VARCHAR, -- WHATSAPP, EMAIL, TELEFONE
  data_hora_comunicacao TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}', 
  observacoes TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE compras_ordens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_ordens ON compras_ordens;
CREATE POLICY all_compras_ordens ON compras_ordens 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Itens da Ordem
CREATE TABLE IF NOT EXISTS compras_oc_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  produto_id BIGINT REFERENCES produtos(id),
  produto_nome VARCHAR,
  descricao_personalizada TEXT,
  quantidade_pedida INT NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(15,2) DEFAULT 0.00,
  preco_tabela NUMERIC(15,2),
  categoria_preco VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE compras_oc_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_oc_itens ON compras_oc_itens;
CREATE POLICY all_compras_oc_itens ON compras_oc_itens 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Comunicações (Timeline)
CREATE TABLE IF NOT EXISTS compras_comunicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  tipo VARCHAR NOT NULL, 
  canal VARCHAR, 
  remetente VARCHAR,
  destinatario VARCHAR,
  conteudo JSONB,
  data_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_comunicacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_comunicacoes ON compras_comunicacoes;
CREATE POLICY all_comunicacoes ON compras_comunicacoes 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Histórico de Alterações (Naming harmonized with Service)
CREATE TABLE IF NOT EXISTS compras_comunicacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  campo VARCHAR NOT NULL, 
  valor_antigo TEXT,
  valor_novo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_comunicacoes_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_comunicacoes_historico ON compras_comunicacoes_historico;
CREATE POLICY all_compras_comunicacoes_historico ON compras_comunicacoes_historico 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Configurações de Markup
CREATE TABLE IF NOT EXISTS compras_markup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id BIGINT REFERENCES fornecedores(id),
  regras JSONB NOT NULL DEFAULT '[]'::jsonb,
  multiplicador_final NUMERIC(10,4) DEFAULT 1.0,
  fator_calculado NUMERIC(10,4),
  bonus_valor JSONB DEFAULT '{"minimo": 0, "desconto_extra": 0}'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_markup_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_markup_configs ON compras_markup_configs;
CREATE POLICY all_compras_markup_configs ON compras_markup_configs 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================================
-- MIGRATION BLOCK (Run to update existing structures)
-- ==========================================================
DO $$ 
BEGIN 
    -- 1. Updates for compras_centro_custos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_centro_custos' AND column_name='tipo') THEN
        ALTER TABLE compras_centro_custos ADD COLUMN tipo VARCHAR DEFAULT 'vendedor';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_centro_custos' AND column_name='ordem_index') THEN
        ALTER TABLE compras_centro_custos ADD COLUMN ordem_index INT DEFAULT 0;
    END IF;

    -- 2. Updates for compras_workflows
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_workflows' AND column_name='tipo') THEN
        ALTER TABLE compras_workflows ADD COLUMN tipo VARCHAR DEFAULT 'vendedor';
    END IF;

    -- 3. Updates for compras_ordens (Communication & Pricing)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='devolutiva') THEN
        ALTER TABLE compras_ordens ADD COLUMN devolutiva TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='quem_aceitou') THEN
        ALTER TABLE compras_ordens ADD COLUMN quem_aceitou VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='tipo_comunicacao') THEN
        ALTER TABLE compras_ordens ADD COLUMN tipo_comunicacao VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='data_hora_comunicacao') THEN
        ALTER TABLE compras_ordens ADD COLUMN data_hora_comunicacao TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='valor_desconto') THEN
        ALTER TABLE compras_ordens ADD COLUMN valor_desconto NUMERIC(15,2) DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='economia_total') THEN
        ALTER TABLE compras_ordens ADD COLUMN economia_total NUMERIC(15,2) DEFAULT 0.00;
    END IF;

    -- 4. Updates for compras_markup_configs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_markup_configs' AND column_name='multiplicador_final') THEN
        ALTER TABLE compras_markup_configs ADD COLUMN multiplicador_final NUMERIC(10,4) DEFAULT 1.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_markup_configs' AND column_name='bonus_valor') THEN
        ALTER TABLE compras_markup_configs ADD COLUMN bonus_valor JSONB DEFAULT '{"minimo": 0, "desconto_extra": 0}'::jsonb;
    END IF;
END $$;
