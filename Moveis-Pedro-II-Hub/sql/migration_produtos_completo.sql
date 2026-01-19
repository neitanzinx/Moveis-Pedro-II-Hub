-- ============================================================
-- Migration: Reestruturação Completa da Tabela de Produtos
-- Data: 2026-01-16
-- Descrição: Adiciona campos para custeio detalhado, markup,
--            descontos, estoque por loja e montagem
-- ============================================================

-- ============================================================
-- PARTE 1: NOVOS CAMPOS DE IDENTIFICAÇÃO E DIMENSÕES
-- ============================================================

-- Modelo/Referência do produto
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS modelo_referencia TEXT;

-- Dimensão extra (para casos especiais)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS dimensao_extra TEXT;

-- ============================================================
-- PARTE 2: CAMPOS DE CUSTEIO DETALHADO
-- ============================================================

-- Percentual de impostos sobre o custo
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS impostos_percentual NUMERIC(5,2) DEFAULT 0;

-- Valor do frete de custo
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS frete_custo NUMERIC(10,2) DEFAULT 0;

-- Percentual de IPI
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ipi_percentual NUMERIC(5,2) DEFAULT 0;

-- ============================================================
-- PARTE 3: GRUPOS DE MARKUP
-- ============================================================

-- Grupo de markup ao qual o produto pertence: 'prontos', 'montagem', 'lustre'
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS grupo_markup TEXT DEFAULT 'prontos';

-- Percentuais de markup por grupo (configuração global, mas pode ter override por produto)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS markup_grupo1_prontos NUMERIC(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS markup_grupo2_montagem NUMERIC(5,2);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS markup_grupo3_lustre NUMERIC(5,2);

-- Markup final aplicado ao produto
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS markup_aplicado NUMERIC(5,2);

-- ============================================================
-- PARTE 4: DESCONTOS MÁXIMOS PERMITIDOS
-- ============================================================

-- Desconto máximo que o vendedor pode dar
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS desconto_max_vendedor NUMERIC(5,2) DEFAULT 5;

-- Desconto máximo gerencial
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS desconto_max_gerencial NUMERIC(5,2) DEFAULT 15;

-- Desconto de campanha A (ex: Black Friday)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS desconto_campanha_a NUMERIC(5,2) DEFAULT 0;

-- Desconto de campanha B (ex: Natal)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS desconto_campanha_b NUMERIC(5,2) DEFAULT 0;

-- ============================================================
-- PARTE 5: ESTOQUE POR LOCALIZAÇÃO
-- ============================================================

-- Estoque no Centro de Distribuição
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_cd INTEGER DEFAULT 0;

-- Mostruário da loja Mega Store
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_mostruario_mega_store INTEGER DEFAULT 0;

-- Mostruário da loja Centro
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_mostruario_centro INTEGER DEFAULT 0;

-- Mostruário da loja Ponte Branca
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_mostruario_ponte_branca INTEGER DEFAULT 0;

-- Mostruário da loja Futura
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_mostruario_futura INTEGER DEFAULT 0;

-- ============================================================
-- PARTE 6: MONTAGEM
-- ============================================================

-- Se o móvel requer montagem
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS requer_montagem BOOLEAN DEFAULT false;

-- Se a montagem é terceirizada
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS montagem_terceirizado BOOLEAN DEFAULT false;

-- Valor da montagem
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS valor_montagem NUMERIC(10,2);

-- ============================================================
-- PARTE 7: MODELOS DE TECIDOS
-- ============================================================

-- Lista de modelos de tecidos disponíveis (JSONB para flexibilidade)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS modelos_tecidos JSONB;

-- ============================================================
-- PARTE 8: ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_produtos_grupo_markup ON produtos(grupo_markup);
CREATE INDEX IF NOT EXISTS idx_produtos_fornecedor_nome ON produtos(fornecedor_nome);
CREATE INDEX IF NOT EXISTS idx_produtos_modelo_referencia ON produtos(modelo_referencia);

-- ============================================================
-- COMENTÁRIOS NAS COLUNAS
-- ============================================================

COMMENT ON COLUMN produtos.modelo_referencia IS 'Modelo ou referência do fabricante';
COMMENT ON COLUMN produtos.impostos_percentual IS 'Percentual de impostos sobre o preço de custo';
COMMENT ON COLUMN produtos.frete_custo IS 'Valor do frete de custo do produto';
COMMENT ON COLUMN produtos.ipi_percentual IS 'Percentual de IPI';
COMMENT ON COLUMN produtos.grupo_markup IS 'Grupo de markup: prontos, montagem ou lustre';
COMMENT ON COLUMN produtos.markup_aplicado IS 'Percentual de markup aplicado ao produto';
COMMENT ON COLUMN produtos.desconto_max_vendedor IS 'Desconto máximo que vendedor pode conceder (%)';
COMMENT ON COLUMN produtos.desconto_max_gerencial IS 'Desconto máximo gerencial (%)';
COMMENT ON COLUMN produtos.desconto_campanha_a IS 'Desconto da campanha A (%)';
COMMENT ON COLUMN produtos.desconto_campanha_b IS 'Desconto da campanha B (%)';
COMMENT ON COLUMN produtos.estoque_cd IS 'Quantidade em estoque no CD';
COMMENT ON COLUMN produtos.estoque_mostruario_mega_store IS 'Quantidade no mostruário Mega Store';
COMMENT ON COLUMN produtos.estoque_mostruario_centro IS 'Quantidade no mostruário Centro';
COMMENT ON COLUMN produtos.estoque_mostruario_ponte_branca IS 'Quantidade no mostruário Ponte Branca';
COMMENT ON COLUMN produtos.estoque_mostruario_futura IS 'Quantidade no mostruário Futura';
COMMENT ON COLUMN produtos.requer_montagem IS 'Se o móvel requer montagem';
COMMENT ON COLUMN produtos.montagem_terceirizado IS 'Se a montagem é feita por terceiro';
COMMENT ON COLUMN produtos.valor_montagem IS 'Valor da montagem do móvel';
COMMENT ON COLUMN produtos.modelos_tecidos IS 'Lista de modelos de tecidos disponíveis (JSON)';
