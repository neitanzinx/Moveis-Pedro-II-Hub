-- migration: Purchase Order Kanban Module - Unified Schema
-- Description: Updated to match implementation property names and include financial/communication fields

-- 1. compras_centro_custos (Salespeople / Departments like FARIA, SHEILA)
CREATE TABLE compras_centro_custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cor VARCHAR,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE compras_centro_custos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_centro_custos ON compras_centro_custos;
CREATE POLICY all_compras_centro_custos ON compras_centro_custos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 2. compras_workflows (Kanban Columns / Statuses)
CREATE TABLE compras_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  cor VARCHAR,
  ordem_index INT NOT NULL,
  allowed_transitions JSONB,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_workflows ON compras_workflows;
CREATE POLICY all_compras_workflows ON compras_workflows 
FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 3. compras_ordens (Purchase Orders / Cards)
CREATE TABLE compras_ordens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido VARCHAR NOT NULL,
  centro_custo_id UUID REFERENCES compras_centro_custos(id),
  fornecedor_id UUID REFERENCES fornecedores(id),
  fornecedor_nome VARCHAR, -- Denormalized for easier display/migration
  status_id UUID REFERENCES compras_workflows(id),
  status VARCHAR, -- Display name fallback (Rascunho, Enviado, etc)
  prioridade VARCHAR DEFAULT 'normal', -- baixa, normal, alta, urgente
  tipo_preco VARCHAR DEFAULT 'normal', -- normal, promocional
  valor_total NUMERIC(15,2) DEFAULT 0.00,
  valor_frete NUMERIC(15,2) DEFAULT 0.00,
  valor_desconto NUMERIC(15,2) DEFAULT 0.00,
  economia_total NUMERIC(15,2) DEFAULT 0.00,
  promocao_observacao TEXT,
  condicoes_pagamento VARCHAR,
  data_pedido TIMESTAMPTZ DEFAULT NOW(),
  data_previsao_entrega DATE,
  prazo_aprovacao TIMESTAMPTZ,
  devolutiva TEXT,
  metadata JSONB, 
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


-- 4. compras_oc_itens (Order Items inside Card)
CREATE TABLE compras_oc_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  produto_nome VARCHAR,
  descricao_personalizada TEXT,
  quantidade_pedida INT NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(15,2) DEFAULT 0.00,
  categoria_preco VARCHAR, -- Tabela A, B, Promocional, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE compras_oc_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_oc_itens ON compras_oc_itens;
CREATE POLICY all_compras_oc_itens ON compras_oc_itens 
FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 5. compras_aprovacoes (Approval system)
CREATE TABLE compras_aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  nivel INT DEFAULT 1,
  status VARCHAR DEFAULT 'pendente', -- pendente, aprovado, rejeitado
  valid_until TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  comentarios TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_aprovacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_aprovacoes ON compras_aprovacoes;
CREATE POLICY all_compras_aprovacoes ON compras_aprovacoes 
FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- 6. compras_comunicacoes (Timeline)
CREATE TABLE compras_comunicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  tipo VARCHAR NOT NULL, -- email, whatsapp, nota_interna
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


-- 7. compras_markup_configs (Supplier Pricing Rules)
CREATE TABLE compras_markup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES fornecedores(id),
  regras JSONB NOT NULL,
  fator_calculado NUMERIC(10,4),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_markup_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_markup_configs ON compras_markup_configs;
CREATE POLICY all_compras_markup_configs ON compras_markup_configs 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
