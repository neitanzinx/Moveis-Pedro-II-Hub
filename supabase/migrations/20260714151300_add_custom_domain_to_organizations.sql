-- Adicionar coluna de domínio customizado para organizações/tenants
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;
