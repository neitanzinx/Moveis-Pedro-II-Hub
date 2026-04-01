-- ============================================================================
-- Migration: Comissoes Flexiveis v1
-- Objetivo: Persistencia confiavel de comissao, regras flexiveis e fechamento mensal.
-- ============================================================================

-- 1) Campos de comissao na tabela de vendas
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS vendedor_id UUID,
  ADD COLUMN IF NOT EXISTS comissao_calculada NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentagem_comissao NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_status VARCHAR(30) DEFAULT 'Calculada',
  ADD COLUMN IF NOT EXISTS comissao_calculada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS comissao_detalhes_json JSONB DEFAULT '[]'::jsonb;

-- 2) Regras de comissao
CREATE TABLE IF NOT EXISTS regras_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  forma_pagamento TEXT,
  percentual NUMERIC(8,4) NOT NULL DEFAULT 0,
  base_calculo VARCHAR(30) NOT NULL DEFAULT 'bruto',
  prioridade INT NOT NULL DEFAULT 0,
  vendedor_id UUID,
  loja TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_regras_comissao_org_ativo
  ON regras_comissao(organization_id, ativo);

CREATE INDEX IF NOT EXISTS idx_regras_comissao_forma
  ON regras_comissao(forma_pagamento);

-- 3) Historico de comissao por venda
CREATE TABLE IF NOT EXISTS comissoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  venda_id UUID NOT NULL,
  vendedor_id UUID,
  regra_comissao_id UUID,
  forma_pagamento TEXT,
  valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentual_aplicado NUMERIC(8,4) NOT NULL DEFAULT 0,
  valor_comissao NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Calculada',
  data_calculo TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_pagamento TIMESTAMPTZ,
  pagamento_id UUID,
  detalhes_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissoes_historico_venda
  ON comissoes_historico(venda_id);

CREATE INDEX IF NOT EXISTS idx_comissoes_historico_status
  ON comissoes_historico(status, data_calculo);

-- 4) Fechamento mensal de comissoes a pagar
CREATE TABLE IF NOT EXISTS comissoes_fechamento_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  vendedor_id UUID,
  loja TEXT,
  quantidade_vendas INT NOT NULL DEFAULT 0,
  valor_total_vendas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_comissao NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_ajustes NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_final NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'Pendente',
  data_pagamento TIMESTAMPTZ,
  pagamento_id UUID,
  breakdown_pagamentos JSONB DEFAULT '{}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissoes_fechamento_periodo
  ON comissoes_fechamento_mensal(periodo_inicio, periodo_fim, status);

-- 5) Opcoes administrativas em organization_settings
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS comissao_prioridade_estrategia VARCHAR(40) DEFAULT 'mais_especifica',
  ADD COLUMN IF NOT EXISTS comissao_recalculo_politica VARCHAR(40) DEFAULT 'nao_recalcular';

-- 6) Backfill de seguranca
UPDATE vendas
SET comissao_calculada = COALESCE(comissao_calculada, 0),
    porcentagem_comissao = COALESCE(porcentagem_comissao, 0),
    comissao_status = COALESCE(comissao_status, 'Calculada')
WHERE comissao_calculada IS NULL
   OR porcentagem_comissao IS NULL
   OR comissao_status IS NULL;

-- 7) Comentarios
COMMENT ON TABLE regras_comissao IS 'Regras configuraveis para calculo de comissao.';
COMMENT ON TABLE comissoes_historico IS 'Historico detalhado de calculo de comissao por venda.';
COMMENT ON TABLE comissoes_fechamento_mensal IS 'Consolidacao mensal de comissoes a pagar.';
