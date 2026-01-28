-- Desabilitar RLS temporariamente para permitir importação
-- Esta é uma solução temporária para desenvolvimento local

-- Desabilitar RLS em fornecedores
ALTER TABLE fornecedores DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS em produtos  
ALTER TABLE produtos DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes de fornecedores
DROP POLICY IF EXISTS "fornecedores_select" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_insert" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_update" ON fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete" ON fornecedores;
DROP POLICY IF EXISTS "Leitura fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Inserção fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Atualização fornecedores" ON fornecedores;
DROP POLICY IF EXISTS "Exclusão fornecedores" ON fornecedores;

-- Remover todas as políticas existentes de produtos
DROP POLICY IF EXISTS "produtos_select" ON produtos;
DROP POLICY IF EXISTS "produtos_insert" ON produtos;
DROP POLICY IF EXISTS "produtos_update" ON produtos;
DROP POLICY IF EXISTS "produtos_delete" ON produtos;
DROP POLICY IF EXISTS "Leitura produtos" ON produtos;
DROP POLICY IF EXISTS "Inserção produtos" ON produtos;
DROP POLICY IF EXISTS "Atualização produtos" ON produtos;
DROP POLICY IF EXISTS "Exclusão produtos" ON produtos;
