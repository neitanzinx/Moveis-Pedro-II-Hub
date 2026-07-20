-- ============================================================================
-- CORREÇÃO DEFINITIVA: Remove TODAS as políticas antigas, mantém somente _isolated
-- ============================================================================

-- Tabelas do sistema SaaS que NÃO devem ser alteradas
-- planos, organizations, saas_operator_users, saas_tenant_daily_usage, 
-- saas_fault_events, organization_settings, produtos_mestre, estoque_loja

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname NOT LIKE '%_isolated'
          AND policyname NOT IN (
            'select_planos_anon', 'select_planos_auth',
            'select_planos_operator', 'insert_planos_operator', 'update_planos_operator'
          )
          AND tablename NOT IN (
            'planos', 'organizations', 'saas_operator_users', 
            'saas_tenant_daily_usage', 'saas_fault_events', 
            'organization_settings', 'produtos_mestre', 'estoque_loja'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Removida: %.% -> %', pol.schemaname, pol.tablename, pol.policyname;
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
