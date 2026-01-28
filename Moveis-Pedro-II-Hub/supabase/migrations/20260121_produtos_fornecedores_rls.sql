-- Adicionar políticas RLS para produtos e fornecedores
-- Isso permite que usuários autenticados gerenciem produtos e fornecedores

-- ============================================
-- FORNECEDORES
-- ============================================

-- Habilitar RLS (se ainda não estiver habilitado)
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários autenticados podem ler
DROP POLICY IF EXISTS "Leitura fornecedores" ON fornecedores;
CREATE POLICY "Leitura fornecedores" ON fornecedores
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Política para INSERT: usuários autenticados podem criar
DROP POLICY IF EXISTS "Insercao fornecedores" ON fornecedores;
CREATE POLICY "Insercao fornecedores" ON fornecedores
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Política para UPDATE: usuários autenticados podem atualizar
DROP POLICY IF EXISTS "Atualizacao fornecedores" ON fornecedores;
CREATE POLICY "Atualizacao fornecedores" ON fornecedores
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Política para DELETE: usuários autenticados podem deletar
DROP POLICY IF EXISTS "Delecao fornecedores" ON fornecedores;
CREATE POLICY "Delecao fornecedores" ON fornecedores
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- PRODUTOS
-- ============================================

-- Habilitar RLS (se ainda não estiver habil itado)
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuários autenticados podem ler
DROP POLICY IF EXISTS "Leitura produtos" ON produtos;
CREATE POLICY "Leitura produtos" ON produtos
    FOR SELECT
    USING (auth.role() = 'authenticated');

--Política para INSERT: usuários autenticados podem criar
DROP POLICY IF EXISTS "Insercao produtos" ON produtos;
CREATE POLICY "Insercao produtos" ON produtos
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Política para UPDATE: usuários autenticados podem atualizar
DROP POLICY IF EXISTS "Atualizacao produtos" ON produtos;
CREATE POLICY "Atualizacao produtos" ON produtos
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Política para DELETE: usuários autenticados podem deletar
DROP POLICY IF EXISTS "Delecao produtos" ON produtos;
CREATE POLICY "Delecao produtos" ON produtos
    FOR DELETE
    USING (auth.role() = 'authenticated');
