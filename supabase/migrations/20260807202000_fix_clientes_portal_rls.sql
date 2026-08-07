-- ====================================================================
-- Script SQL para executar no Supabase SQL Editor
-- Corrige permissões e políticas RLS para o Portal do Cliente
-- ====================================================================

-- 1. Garantir que as colunas necessárias existam
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.fidelidade_config ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.fidelidade_historico ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. Tabela: clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_clientes ON public.clientes;
DROP POLICY IF EXISTS clientes_isolated ON public.clientes;
DROP POLICY IF EXISTS clientes_portal_access ON public.clientes;
DROP POLICY IF EXISTS "Permitir clientes gerenciarem proprio perfil" ON public.clientes;
DROP POLICY IF EXISTS "Clientes portal select" ON public.clientes;
DROP POLICY IF EXISTS "Clientes portal insert" ON public.clientes;
DROP POLICY IF EXISTS "Clientes portal update" ON public.clientes;

CREATE POLICY all_clientes ON public.clientes 
FOR ALL TO authenticated USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  OR (SELECT public.get_user_org_id()) IS NULL
) WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  OR (created_by IS NOT NULL AND created_by::text = auth.uid()::text)
  OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  OR (SELECT public.get_user_org_id()) IS NULL
);

-- 3. Tabela: vendas
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_vendas ON public.vendas;
DROP POLICY IF EXISTS vendas_isolated ON public.vendas;

CREATE POLICY all_vendas ON public.vendas 
FOR ALL TO authenticated USING (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR cliente_id::text IN (
    SELECT id::text FROM public.clientes 
    WHERE (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
       OR (email IS NOT NULL AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
  )
  OR (SELECT public.get_user_org_id()) IS NULL
) WITH CHECK (
  auth.jwt() ->> 'role' = 'service_role'
  OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
  OR (SELECT public.get_user_org_id()) IS NULL
);

-- 4. Tabela: fidelidade_config
ALTER TABLE public.fidelidade_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_fidelidade_config ON public.fidelidade_config;
DROP POLICY IF EXISTS select_fidelidade_config_all ON public.fidelidade_config;
DROP POLICY IF EXISTS manage_fidelidade_config ON public.fidelidade_config;
DROP POLICY IF EXISTS select_fidelidade_config_anon ON public.fidelidade_config;

CREATE POLICY all_fidelidade_config ON public.fidelidade_config 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY select_fidelidade_config_anon ON public.fidelidade_config 
FOR SELECT TO anon USING (true);

-- 5. Tabela: fidelidade_historico
ALTER TABLE public.fidelidade_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_fidelidade_historico ON public.fidelidade_historico;
DROP POLICY IF EXISTS employees_all_historico ON public.fidelidade_historico;
DROP POLICY IF EXISTS fidelidade_historico_all ON public.fidelidade_historico;

CREATE POLICY all_fidelidade_historico ON public.fidelidade_historico 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Tabela: cliente_sessoes_portal
ALTER TABLE public.cliente_sessoes_portal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_cliente_sessoes_portal ON public.cliente_sessoes_portal;
DROP POLICY IF EXISTS cliente_sessoes_portal_all ON public.cliente_sessoes_portal;
DROP POLICY IF EXISTS cliente_sessoes_portal_insert_own ON public.cliente_sessoes_portal;
DROP POLICY IF EXISTS cliente_sessoes_portal_select_own_or_admin ON public.cliente_sessoes_portal;
DROP POLICY IF EXISTS cliente_sessoes_portal_update_own_or_admin ON public.cliente_sessoes_portal;

CREATE POLICY all_cliente_sessoes_portal ON public.cliente_sessoes_portal 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Tabela: cliente_acesso_eventos
ALTER TABLE public.cliente_acesso_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_cliente_acesso_eventos ON public.cliente_acesso_eventos;
DROP POLICY IF EXISTS cliente_acesso_eventos_all ON public.cliente_acesso_eventos;
DROP POLICY IF EXISTS cliente_acesso_eventos_insert_own ON public.cliente_acesso_eventos;
DROP POLICY IF EXISTS cliente_acesso_eventos_select_own_or_admin ON public.cliente_acesso_eventos;

CREATE POLICY all_cliente_acesso_eventos ON public.cliente_acesso_eventos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
