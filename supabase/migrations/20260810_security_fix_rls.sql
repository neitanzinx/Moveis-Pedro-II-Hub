-- ====================================================================
-- SECURITY FIX: Correção de políticas RLS vulneráveis
-- Data: 2026-08-10
-- Corrige 3 problemas validados:
-- 1. public_users: exposição total para anon (23 registros vazados)
-- 2. clientes: escape multi-tenant via get_user_org_id() IS NULL
-- 3. vendas: escape multi-tenant via get_user_org_id() IS NULL
-- ====================================================================

-- ==========================================
-- 1. REVOGAR ACESSO ANÔNIMO a public_users
-- ==========================================
-- A política "Permitir leitura anonima para login" concede SELECT *
-- para ANY anon user com ativo = true. Isso vaza nomes, emails,
-- matrículas e cargos de 23 funcionários.
-- A RPC resolve_login_email (SECURITY DEFINER) já cobre o login.

DROP POLICY IF EXISTS "Permitir leitura anonima para login" ON public.public_users;

-- ==========================================
-- 2. CORRIGIR POLÍTICA DE clientes
-- ==========================================
-- Remove: OR (SELECT public.get_user_org_id()) IS NULL
-- Essa cláusula concede acesso TOTAL a qualquer usuário autenticado
-- sem organization_id (ex: clientes do portal recém-cadastrados).
-- O acesso por user_id e email já cobre o caso do portal.

DROP POLICY IF EXISTS all_clientes ON public.clientes;

CREATE POLICY all_clientes ON public.clientes 
FOR ALL TO authenticated USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
) WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  OR (created_by IS NOT NULL AND created_by::text = auth.uid()::text)
  OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
);

-- ==========================================
-- 3. CORRIGIR POLÍTICA DE vendas
-- ==========================================
-- Remove: OR (SELECT public.get_user_org_id()) IS NULL
-- O acesso de clientes do portal já é garantido pela subquery em cliente_id.

DROP POLICY IF EXISTS all_vendas ON public.vendas;

CREATE POLICY all_vendas ON public.vendas 
FOR ALL TO authenticated USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR cliente_id::text IN (
    SELECT id::text FROM public.clientes 
    WHERE (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
       OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  )
) WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
);

-- ==========================================
-- 4. Notificar PostgREST para recarregar schema
-- ==========================================
NOTIFY pgrst, 'reload schema';
