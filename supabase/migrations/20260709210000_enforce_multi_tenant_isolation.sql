-- Migration: enforce_multi_tenant_isolation
-- Date: 2026-07-09

-- 1. Recriar a função helper public.get_user_org_id() apontando para public_users
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.public_users WHERE id = auth.uid();
$$;

-- 2. Garantir que organization_id existe e associar defaults
ALTER TABLE public.public_users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.cargos ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.entregas ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.montagens ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();
ALTER TABLE public.assistencias_tecnicas ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id();

ALTER TABLE public.public_users ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.vendas ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.clientes ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.produtos ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.fornecedores ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.orcamentos ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.lojas ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.cargos ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.devolucoes ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.entregas ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.montagens ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();
ALTER TABLE public.assistencias_tecnicas ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();

-- 3. Habilitar RLS em todas as tabelas principais
ALTER TABLE public.public_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.montagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistencias_tecnicas ENABLE ROW LEVEL SECURITY;

-- 4. Remover políticas antigas para evitar conflitos de segurança
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.public_users;
DROP POLICY IF EXISTS "Usuarios aprovados veem vendas" ON public.vendas;
DROP POLICY IF EXISTS "Cargos especificos editam vendas" ON public.vendas;
DROP POLICY IF EXISTS "Service role bypass vendas" ON public.vendas;
DROP POLICY IF EXISTS "Usuarios aprovados veem clientes" ON public.clientes;
DROP POLICY IF EXISTS "Cargos especificos criam clientes" ON public.clientes;
DROP POLICY IF EXISTS "Gerentes editam clientes" ON public.clientes;
DROP POLICY IF EXISTS "Vendedor edita proprios clientes" ON public.clientes;
DROP POLICY IF EXISTS "Gerentes excluem clientes" ON public.clientes;
DROP POLICY IF EXISTS "Service role bypass clientes" ON public.clientes;
DROP POLICY IF EXISTS "Todos veem produtos" ON public.produtos;
DROP POLICY IF EXISTS "Estoque edita produtos" ON public.produtos;
DROP POLICY IF EXISTS "Service role bypass produtos" ON public.produtos;
DROP POLICY IF EXISTS "Logistica ve entregas" ON public.entregas;
DROP POLICY IF EXISTS "Logistica edita entregas" ON public.entregas;
DROP POLICY IF EXISTS "Service role bypass entregas" ON public.entregas;
DROP POLICY IF EXISTS "Usuarios veem montagens" ON public.montagens;
DROP POLICY IF EXISTS "Logistica edita montagens" ON public.montagens;
DROP POLICY IF EXISTS "Service role bypass montagens" ON public.montagens;
DROP POLICY IF EXISTS "Users can view lojas from their organization" ON public.lojas;
DROP POLICY IF EXISTS "Admins can manage lojas" ON public.lojas;

-- 5. Criar políticas unificadas de isolamento multi-tenant (RLS)

-- public_users
CREATE POLICY public_users_isolated ON public.public_users FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- vendas
CREATE POLICY vendas_isolated ON public.vendas FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- clientes
CREATE POLICY clientes_isolated ON public.clientes FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- produtos
CREATE POLICY produtos_isolated ON public.produtos FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- fornecedores
CREATE POLICY fornecedores_isolated ON public.fornecedores FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- orcamentos
CREATE POLICY orcamentos_isolated ON public.orcamentos FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- lojas
CREATE POLICY lojas_isolated ON public.lojas FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- cargos
CREATE POLICY cargos_isolated ON public.cargos FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- devolucoes
CREATE POLICY devolucoes_isolated ON public.devolucoes FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- entregas
CREATE POLICY entregas_isolated ON public.entregas FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- montagens
CREATE POLICY montagens_isolated ON public.montagens FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- assistencias_tecnicas
CREATE POLICY assistencias_tecnicas_isolated ON public.assistencias_tecnicas FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role' OR organization_id = public.get_user_org_id()
);

-- planos (Allow anonymous users to view active plans during registration)
DROP POLICY IF EXISTS select_planos_anon ON public.planos;
CREATE POLICY select_planos_anon ON public.planos FOR SELECT TO anon USING (ativo = true);

-- Forçar recarregamento de schema
NOTIFY pgrst, 'reload schema';
