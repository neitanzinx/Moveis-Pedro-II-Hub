-- ============================================================================
-- FIX: Restaurar acesso de leitura anônima para a tabela public_users
-- ============================================================================
-- O script 20260716200000_fix_rls_timeout.sql substituiu todas as políticas
-- por uma restrição rigorosa de tenant (organization_id). Isso bloqueou a 
-- capacidade do frontend de consultar a matrícula/email do usuário ANTES do login.
-- Esta política permite apenas SELECT por usuários anônimos.

-- Remover política anterior se existir (para evitar duplicações)
DROP POLICY IF EXISTS "Permitir leitura anonima para login" ON public.public_users;

-- Criar política permitindo que usuários anônimos consultem a tabela
CREATE POLICY "Permitir leitura anonima para login"
ON public.public_users
FOR SELECT
TO anon
USING (ativo = true);

-- Garante que o PostgREST atualize o schema cache
NOTIFY pgrst, 'reload schema';
