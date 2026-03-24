-- Migration: Atualizar tabela alertas_recompra com colunas faltantes
-- ==============================================================================
-- Issue: useAlertasEstoque.jsx tenta usar coluna 'habilitado' que não existe
-- Erro: column alertas_recompra.habilitado does not exist
-- ==============================================================================

-- Adicionar colunas faltantes à tabela alertas_recompra
ALTER TABLE IF EXISTS alertas_recompra
ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
ADD COLUMN IF NOT EXISTS fornecedor_id UUID,
ADD COLUMN IF NOT EXISTS estoque_minimo INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS estoque_ideal INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS loja_id UUID,
ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS habilitado BOOLEAN DEFAULT true;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_tenant_id ON alertas_recompra(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_produto_id ON alertas_recompra(produto_id);
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_loja_id ON alertas_recompra(loja_id);
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_fornecedor_id ON alertas_recompra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_status ON alertas_recompra(status);
CREATE INDEX IF NOT EXISTS idx_alertas_recompra_habilitado ON alertas_recompra(habilitado);

-- Comentar colunas para documentação
COMMENT ON COLUMN alertas_recompra.tenant_id IS 'ID do tenant/organização (multi-tenant)';
COMMENT ON COLUMN alertas_recompra.habilitado IS 'Se o alerta está ativo/habilitado';
COMMENT ON COLUMN alertas_recompra.estoque_minimo IS 'Quantidade mínima de estoque antes de alertar';
COMMENT ON COLUMN alertas_recompra.estoque_ideal IS 'Quantidade ideal de estoque';
COMMENT ON COLUMN alertas_recompra.fornecedor_id IS 'Fornecedor sugerido para recompra';
COMMENT ON COLUMN alertas_recompra.loja_id IS 'Loja/ponto de venda para este alerta';
COMMENT ON COLUMN alertas_recompra.produto_nome IS 'Nome do produto (cache)';
COMMENT ON COLUMN alertas_recompra.lido IS 'Se o alerta foi lido/visto';

-- ============================================================================
-- RLS (Row Level Security) - Opcional (comentado por padrão)
-- ============================================================================
-- Descomente se RLS está habilitado no seu projeto
-- ALTER TABLE alertas_recompra ENABLE ROW LEVEL SECURITY;
-- 
-- DROP POLICY IF EXISTS "alertas_recompra_tenant_isolation" ON alertas_recompra;
-- CREATE POLICY "alertas_recompra_tenant_isolation" ON alertas_recompra
--   FOR ALL
--   USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()) OR auth.uid() IS NULL);

-- ============================================================================
-- Validar dados: atualizar registros existentes
-- ============================================================================
UPDATE alertas_recompra 
SET 
  habilitado = CASE WHEN status = 'ativo' THEN true ELSE false END,
  tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE habilitado IS NULL
   OR tenant_id IS NULL;

-- ============================================================================
-- Log de execução (opcional - só se tabela _migration_log existir)
-- ============================================================================
-- Se você tem uma tabela _migration_log, descomente:
-- INSERT INTO public._migration_log (migration_name, status, details)
-- VALUES (
--   'migration_alertas_recompra_fix',
--   'success',
--   'Adicionadas colunas faltantes: habilitado, tenant_id, fornecedor_id, loja_id, produto_nome, estoque_minimo, estoque_ideal'
-- ) ON CONFLICT (migration_name) DO UPDATE SET 
--   status = 'success',
--   executed_at = now(),
--   details = 'Adicionadas colunas faltantes: habilitado, tenant_id, fornecedor_id, loja_id, produto_nome, estoque_minimo, estoque_ideal';
