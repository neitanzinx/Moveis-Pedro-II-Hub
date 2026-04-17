-- =====================================================================
-- MIGRATION: Classificação e Rastreabilidade de Itens da OC
-- Data: 2026-04-17
-- Descrição: Adiciona campos estruturados a compras_oc_itens para:
--   1. Tipo do item (assistência reposição, assistência venda, ordem comum)
--   2. Origem da solicitação (vendedor, estoque, assistência)
--   3. Nome completo do produto (sem truncamento)
--   4. Cor específica escolhida para o item
--   5. Dados de contexto de assistência técnica
--   6. Anexos de evidência (JSONB array)
-- Compatibilidade: additive only, sem remover colunas existentes.
-- =====================================================================

-- 1. Tipo do item por linha de OC
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS tipo_item_oc VARCHAR(50) DEFAULT 'ORDEM_COMUM_ENCOMENDA'
    CHECK (tipo_item_oc IN (
        'ORDEM_COMUM_ENCOMENDA',
        'ASSISTENCIA_REPOSICAO_PECAS',
        'ASSISTENCIA_VENDA_CLIENTE'
    ));

-- 2. Origem da solicitação
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS origem_solicitacao VARCHAR(30) DEFAULT 'VENDEDOR'
    CHECK (origem_solicitacao IN (
        'VENDEDOR',
        'ESTOQUE',
        'ASSISTENCIA'
    ));

-- 3. Nome completo do produto (campo separado para evitar truncamento)
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS nome_completo_produto VARCHAR(500);

-- 4. Cor específica escolhida para este item
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS cor_item VARCHAR(150);

-- 5. Campos de contexto de assistência técnica
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS pedido_origem_numero VARCHAR(100);

ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS reposicao_fabrica BOOLEAN DEFAULT FALSE;

ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS motivo_assistencia TEXT;

ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS possui_imagens_videos BOOLEAN DEFAULT FALSE;

-- 6. Anexos de evidência por item (array de objetos: {nome, url, tipo, uploaded_at})
ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS anexos_item JSONB DEFAULT '[]';

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_oc_itens_tipo_item
    ON compras_oc_itens(tipo_item_oc);

CREATE INDEX IF NOT EXISTS idx_oc_itens_origem
    ON compras_oc_itens(origem_solicitacao);

CREATE INDEX IF NOT EXISTS idx_oc_itens_cor_item
    ON compras_oc_itens(cor_item);

-- Backfill: preencher nome_completo_produto a partir de produto_nome existente
-- (compatibilidade: registros antigos ficam com mesmo nome)
UPDATE compras_oc_itens
SET nome_completo_produto = produto_nome
WHERE nome_completo_produto IS NULL
  AND produto_nome IS NOT NULL;

-- Backfill: extrair cor de descricao_personalizada quando cor_item estiver vazio
-- Padrão esperado na descrição: "Cor: Azul | Material: ..."
UPDATE compras_oc_itens
SET cor_item = TRIM(SPLIT_PART(SPLIT_PART(descricao_personalizada, 'Cor: ', 2), ' |', 1))
WHERE cor_item IS NULL
  AND descricao_personalizada LIKE '%Cor: %'
  AND TRIM(SPLIT_PART(SPLIT_PART(descricao_personalizada, 'Cor: ', 2), ' |', 1)) <> '';

-- Comentários de documentação
COMMENT ON COLUMN compras_oc_itens.tipo_item_oc IS
    'Classificação do item: ORDEM_COMUM_ENCOMENDA | ASSISTENCIA_REPOSICAO_PECAS | ASSISTENCIA_VENDA_CLIENTE';

COMMENT ON COLUMN compras_oc_itens.origem_solicitacao IS
    'Origem: VENDEDOR | ESTOQUE | ASSISTENCIA';

COMMENT ON COLUMN compras_oc_itens.nome_completo_produto IS
    'Nome completo sem truncamento (ex: Mesa de Cabeceira Valente). Prefere-se este campo ao produto_nome legado.';

COMMENT ON COLUMN compras_oc_itens.cor_item IS
    'Cor específica selecionada para este item da OC (ex: Cedro/Areia). Não agregar múltiplas cores.';

COMMENT ON COLUMN compras_oc_itens.pedido_origem_numero IS
    'Número do pedido/venda de origem (ex: 2809). Relevante para assistência.';

COMMENT ON COLUMN compras_oc_itens.reposicao_fabrica IS
    'Indica se a reposição é responsabilidade da fábrica (SIM/NÃO).';

COMMENT ON COLUMN compras_oc_itens.motivo_assistencia IS
    'Motivo da assistência/defeito (ex: Lascado na ponta). Obrigatório para tipos de assistência.';

COMMENT ON COLUMN compras_oc_itens.possui_imagens_videos IS
    'Indica se existem imagens ou vídeos de evidência disponíveis.';

COMMENT ON COLUMN compras_oc_itens.anexos_item IS
    'Array JSON de anexos: [{nome, url, tipo, uploaded_at}]. Evidências por item da OC.';
