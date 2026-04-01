-- ============================================================
-- FASE 1: POLÍTICAS DE ESTOQUE INTELIGENTES
-- Data: 2026-03-30
-- Status: APLICADO via MCP Supabase
-- Projeto: stgatkuwnouzwczkpphs (Móveis Pedro II)
-- Objetivo: Sistema híbrido por fornecedor (com override por produto)
-- para controlar comportamento de venda sem estoque.
-- Escolha: Requer aprovação gerencial quando sem estoque.
--
-- NOTA: Tabela movimentacoes_estoque já existe no banco.
-- ENUMs não foram criados; usa-se TEXT com CHECK constraints.
-- ============================================================

-- -------------------------------------------------------
-- 1. CAMPOS em produtos: política de estoque por produto
-- -------------------------------------------------------
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS tipo_estoque              TEXT DEFAULT 'herdado'
    CHECK (tipo_estoque IN ('pronta_entrega', 'sob_encomenda', 'flexivel', 'herdado')),
  ADD COLUMN IF NOT EXISTS pode_vender_sem_estoque  BOOLEAN DEFAULT NULL,     -- NULL = herda de fornecedor
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias       INTEGER DEFAULT NULL,     -- NULL = herda de fornecedor
  ADD COLUMN IF NOT EXISTS requires_approval        BOOLEAN DEFAULT NULL;     -- NULL = herda de fornecedor

COMMENT ON COLUMN produtos.tipo_estoque             IS 'Política de disponibilidade: herdado usa config do fornecedor';
COMMENT ON COLUMN produtos.pode_vender_sem_estoque  IS 'NULL = herda do fornecedor; true = permite; false = bloqueia';
COMMENT ON COLUMN produtos.prazo_entrega_dias       IS 'NULL = usa prazo padrão do fornecedor';
COMMENT ON COLUMN produtos.requires_approval        IS 'NULL = herda do fornecedor; true = requer aprovação gerencial';

-- -------------------------------------------------------
-- 2. CAMPOS em fornecedores: política padrão para todos os produtos
-- -------------------------------------------------------
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS tipo_estoque_padrao         TEXT DEFAULT 'flexivel'
    CHECK (tipo_estoque_padrao IN ('pronta_entrega', 'sob_encomenda', 'flexivel')),
  ADD COLUMN IF NOT EXISTS aprovacao_obrigatoria        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS prazo_entrega_dias_padrao    INTEGER DEFAULT 15;

COMMENT ON COLUMN fornecedores.tipo_estoque_padrao        IS 'Política padrão aplicada a todos os produtos do fornecedor';
COMMENT ON COLUMN fornecedores.aprovacao_obrigatoria      IS 'Se true, vendas sem estoque requerem aprovação gerencial';
COMMENT ON COLUMN fornecedores.prazo_entrega_dias_padrao  IS 'Dias úteis de entrega para encomendas deste fornecedor';

-- -------------------------------------------------------
-- 3. CAMPOS em solicitacoes_encomenda: rastreio de motivo e aprovação
-- -------------------------------------------------------
ALTER TABLE solicitacoes_encomenda
  ADD COLUMN IF NOT EXISTS motivo_encomenda        TEXT DEFAULT 'sem_estoque'
    CHECK (motivo_encomenda IN ('sem_estoque', 'aprovacao_gerencial', 'produto_sob_encomenda', 'ajuste_manual')),
  ADD COLUMN IF NOT EXISTS aprovado_por            UUID REFERENCES public_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome        TEXT,
  ADD COLUMN IF NOT EXISTS data_aprovacao           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitado_em             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes_gerencial    TEXT,
  ADD COLUMN IF NOT EXISTS loja                     TEXT,
  ADD COLUMN IF NOT EXISTS quantidade_aprovada      INTEGER;

-- Status novo: incluir 'aguardando_aprovacao' e 'rejeitado'
-- (o campo já é TEXT, sem enum, então apenas documentamos os valores esperados)
COMMENT ON COLUMN solicitacoes_encomenda.status IS
  'pendente | aguardando_aprovacao | aprovado | rejeitado | cancelada | cancelada_retida_cd';
COMMENT ON COLUMN solicitacoes_encomenda.motivo_encomenda IS
  'Por que virou encomenda: sem_estoque | aprovacao_gerencial | produto_sob_encomenda | ajuste_manual';

CREATE INDEX IF NOT EXISTS idx_sol_enc_motivo ON solicitacoes_encomenda(motivo_encomenda);
CREATE INDEX IF NOT EXISTS idx_sol_enc_aprovado_por ON solicitacoes_encomenda(aprovado_por);

-- -------------------------------------------------------
-- 4. FUNÇÃO: fn_validar_estoque_venda
--    Centraliza toda a lógica de validação.
--    Chamada pelo frontend via RPC antes de confirmar venda.
--    NOTA: produto_id e loja_id são BIGINT (não UUID)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_estoque_venda(
  p_produto_id  BIGINT,
  p_quantidade  INTEGER,
  p_loja_id     BIGINT  DEFAULT NULL,
  p_usuario_id  UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_produto         RECORD;
  v_fornecedor      RECORD;
  v_tipo_efetivo    TEXT;
  v_aprovacao_req   BOOLEAN;
  v_prazo           INTEGER;
  v_pode_vender_sf  BOOLEAN;
  v_qtd_disponivel  INTEGER;
  v_resultado       JSONB;
BEGIN
  -- Buscar produto
  SELECT id, nome, quantidade_estoque, quantidade_reservada,
         fornecedor_nome, tipo_estoque, pode_vender_sem_estoque,
         prazo_entrega_dias, requires_approval
  INTO v_produto
  FROM produtos WHERE id = p_produto_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pode_vender', false,
      'motivo', 'Produto não encontrado',
      'requer_aprovacao', false,
      'prazo_dias', 15,
      'total_estoque', 0,
      'total_disponivel', 0
    );
  END IF;

  -- Calcular disponibilidade
  v_qtd_disponivel := COALESCE(v_produto.quantidade_estoque, 0)
                    - COALESCE(v_produto.quantidade_reservada, 0);

  -- Buscar fornecedor pelo nome (campo denormalizado)
  SELECT
    id, tipo_estoque_padrao, aprovacao_obrigatoria, prazo_entrega_dias_padrao, encomendas_habilitadas
  INTO v_fornecedor
  FROM fornecedores
  WHERE LOWER(TRIM(nome_empresa)) = LOWER(TRIM(v_produto.fornecedor_nome))
  LIMIT 1;

  -- Resolver tipo efetivo pela hierarquia: produto > fornecedor > padrão
  IF v_produto.tipo_estoque IS NOT NULL AND v_produto.tipo_estoque::TEXT != 'herdado' THEN
    v_tipo_efetivo := v_produto.tipo_estoque::TEXT;
  ELSIF v_fornecedor.tipo_estoque_padrao IS NOT NULL THEN
    v_tipo_efetivo := v_fornecedor.tipo_estoque_padrao::TEXT;
  ELSE
    v_tipo_efetivo := 'flexivel';
  END IF;

  -- Resolver: pode_vender_sem_estoque
  IF v_produto.pode_vender_sem_estoque IS NOT NULL THEN
    v_pode_vender_sf := v_produto.pode_vender_sem_estoque;
  ELSIF v_fornecedor.encomendas_habilitadas IS NOT NULL THEN
    v_pode_vender_sf := v_fornecedor.encomendas_habilitadas;
  ELSE
    v_pode_vender_sf := true;
  END IF;

  -- Resolver: requer aprovação
  IF v_produto.requires_approval IS NOT NULL THEN
    v_aprovacao_req := v_produto.requires_approval;
  ELSIF v_fornecedor.aprovacao_obrigatoria IS NOT NULL THEN
    v_aprovacao_req := v_fornecedor.aprovacao_obrigatoria;
  ELSE
    v_aprovacao_req := true;
  END IF;

  -- Resolver: prazo de entrega
  IF v_produto.prazo_entrega_dias IS NOT NULL THEN
    v_prazo := v_produto.prazo_entrega_dias;
  ELSIF v_fornecedor.prazo_entrega_dias_padrao IS NOT NULL THEN
    v_prazo := v_fornecedor.prazo_entrega_dias_padrao;
  ELSE
    v_prazo := 15;
  END IF;

  -- ======================================
  -- REGRA DE NEGÓCIO CENTRAL
  -- ======================================

  -- Tipo: sempre encomenda (independente de estoque)
  IF v_tipo_efetivo = 'sob_encomenda' THEN
    RETURN jsonb_build_object(
      'pode_vender',       true,
      'eh_encomenda',      true,
      'requer_aprovacao',  v_aprovacao_req,
      'motivo',            'Produto configurado como sob-encomenda',
      'tipo_efetivo',      v_tipo_efetivo,
      'prazo_dias',        v_prazo,
      'total_estoque',     COALESCE(v_produto.quantidade_estoque, 0),
      'total_disponivel',  v_qtd_disponivel
    );
  END IF;

  -- Tem estoque suficiente: venda normal
  IF v_qtd_disponivel >= p_quantidade THEN
    RETURN jsonb_build_object(
      'pode_vender',       true,
      'eh_encomenda',      false,
      'requer_aprovacao',  false,
      'motivo',            'Estoque disponível',
      'tipo_efetivo',      v_tipo_efetivo,
      'prazo_dias',        0,
      'total_estoque',     COALESCE(v_produto.quantidade_estoque, 0),
      'total_disponivel',  v_qtd_disponivel
    );
  END IF;

  -- Sem estoque: tipo pronta_entrega = BLOQUEIO
  IF v_tipo_efetivo = 'pronta_entrega' OR v_pode_vender_sf = false THEN
    RETURN jsonb_build_object(
      'pode_vender',       false,
      'eh_encomenda',      false,
      'requer_aprovacao',  false,
      'motivo',            'Produto de pronta entrega sem estoque disponível',
      'tipo_efetivo',      v_tipo_efetivo,
      'prazo_dias',        0,
      'total_estoque',     COALESCE(v_produto.quantidade_estoque, 0),
      'total_disponivel',  v_qtd_disponivel
    );
  END IF;

  -- Sem estoque: tipo flexivel = requer aprovação gerencial
  RETURN jsonb_build_object(
    'pode_vender',       true,
    'eh_encomenda',      true,
    'requer_aprovacao',  v_aprovacao_req,
    'motivo',            'Estoque insuficiente. Requer aprovação gerencial para prosseguir como encomenda.',
    'tipo_efetivo',      v_tipo_efetivo,
    'prazo_dias',        v_prazo,
    'total_estoque',     COALESCE(v_produto.quantidade_estoque, 0),
    'total_disponivel',  v_qtd_disponivel
  );
END;
$$;

-- -------------------------------------------------------
-- 5. GRANT e ÍNDICES
-- -------------------------------------------------------
GRANT EXECUTE ON FUNCTION fn_validar_estoque_venda(BIGINT, INTEGER, BIGINT, UUID) TO authenticated;


CREATE INDEX IF NOT EXISTS idx_produtos_tipo_estoque ON produtos(tipo_estoque);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tipo_padrao ON fornecedores(tipo_estoque_padrao);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome_lower ON fornecedores(LOWER(TRIM(nome_empresa)));

-- -------------------------------------------------------
-- Verificação final
-- -------------------------------------------------------
DO $$ BEGIN
  RAISE NOTICE '✅ migration_politicas_estoque: Concluída com sucesso.';
  RAISE NOTICE '   Tabelas modificadas: produtos, fornecedores, solicitacoes_encomenda';
  RAISE NOTICE '   Tabelas criadas: estoque_movimentacoes';
  RAISE NOTICE '   Funções criadas: fn_validar_estoque_venda()';
  RAISE NOTICE '   ENUMs criados: tipo_politica_estoque, motivo_encomenda';
END $$;
