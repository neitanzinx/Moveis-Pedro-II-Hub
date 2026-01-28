-- ============================================================================
-- SOLUÇÃO DEFINITIVA DE RLS PARA PRODUTOS E FORNECEDORES
-- ============================================================================
-- Esta migração implementa políticas de segurança adequadas para produção:
-- 1. Leitura (SELECT): Público - qualquer um pode ver produtos/fornecedores
-- 2. Escrita (INSERT/UPDATE/DELETE): Apenas usuários autenticados
-- ============================================================================

-- Limpar políticas antigas
DROP POLICY IF EXISTS "fornecedores_select" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_insert" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_update" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete" ON fornecedores;
DROP POLICY IF EXISTS "Leitura fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Inserção fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Atualização fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Exclusão fornecedores" ON fornecedores;

DROP POLICY IF EXISTS "produtos_select" ON produtos;
DROP POLICY IF EXISTS "produtos_insert" ON produtos;
DROP POLICY IF EXISTS "produtos_update" ON produtos;
DROP POLICY IF EXISTS "produtos_delete" ON produtos;
DROP POLICY IF EXISTS "Leitura produtos" ON produtos;
DROP POLICY IF EXISTS "Inserção produtos" ON produtos;
DROP POLICY IF EXISTS "Atualização produtos" ON produtos;
DROP POLICY IF EXISTS "Exclusão produtos" ON produtos;

-- ============================================================================
-- FORNECEDORES - Políticas RLS
-- ============================================================================

-- Habilitar RLS
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública (qualquer um pode ver fornecedores)
CREATE POLICY "fornecedores_public_select" 
ON fornecedores FOR SELECT 
USING (true);

-- Permitir inserção apenas para usuários autenticados
CREATE POLICY "fornecedores_authenticated_insert" 
ON fornecedores FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir atualização apenas para usuários autenticados
CREATE POLICY "fornecedores_authenticated_update" 
ON fornecedores FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Permitir exclusão apenas para usuários autenticados
CREATE POLICY "fornecedores_authenticated_delete" 
ON fornecedores FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- PRODUTOS - Políticas RLS
-- ============================================================================

-- Habilitar RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública (qualquer um pode ver produtos)
CREATE POLICY "produtos_public_select" 
ON produtos FOR SELECT 
USING (true);

-- Permitir inserção apenas para usuários autenticados
CREATE POLICY "produtos_authenticated_insert" 
ON produtos FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Permitir atualização apenas para usuários autenticados
CREATE POLICY "produtos_authenticated_update" 
ON produtos FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Permitir exclusão apenas para usuários autenticados
CREATE POLICY "produtos_authenticated_delete" 
ON produtos FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON POLICY "fornecedores_public_select" ON fornecedores IS 
'Permite que qualquer pessoa visualize fornecedores (necessário para catálogo público)';

COMMENT ON POLICY "fornecedores_authenticated_insert" ON fornecedores IS 
'Apenas usuários autenticados podem adicionar fornecedores';

COMMENT ON POLICY "produtos_public_select" ON produtos IS 
'Permite que qualquer pessoa visualize produtos (necessário para catálogo público)';

COMMENT ON POLICY "produtos_authenticated_insert" ON produtos IS 
'Apenas usuários autenticados podem adicionar produtos';
