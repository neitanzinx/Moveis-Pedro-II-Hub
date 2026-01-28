-- Migration: Sistema de Produtos Hierárquicos (Pai → Variações SKU)
-- Objetivo: Permitir agrupamento visual mas controle de estoque por SKU individual

-- 1. Adicionar novos campos à tabela produtos
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS is_parent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES produtos(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS sku text;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_produtos_parent_id ON produtos(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_is_parent ON produtos(is_parent) WHERE is_parent = true;
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku) WHERE sku IS NOT NULL;

-- 3. Constraint: variação deve ter parent_id
-- (Comentado porque alguns produtos existentes podem não ter estrutura ainda)
-- ALTER TABLE produtos ADD CONSTRAINT chk_variacao_parent 
--   CHECK (is_parent = true OR parent_id IS NOT NULL OR (is_parent = false AND parent_id IS NULL));

-- 4. Comentários para documentação
COMMENT ON COLUMN produtos.is_parent IS 'True = Produto Pai (agrupador visual, não pode ser vendido)';
COMMENT ON COLUMN produtos.parent_id IS 'Referência ao produto pai para variações';
COMMENT ON COLUMN produtos.sku IS 'Código único da variação (ex: ALT-GRO-0001-MEL-01)';
