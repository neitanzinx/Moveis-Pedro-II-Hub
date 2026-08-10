-- ====================================================================
-- MIGRATION: Multi-Tenant para o Bot de WhatsApp e Configurações
-- Data: 2026-08-10
-- Objetivo: Isolar sessões, templates, cupons e filas por organization_id
-- ====================================================================

-- 1. Tabela: whatsapp_bot_settings (Adicionar organization_id e atualizar unicidade)
ALTER TABLE public.whatsapp_bot_settings 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill para organização padrão
UPDATE public.whatsapp_bot_settings 
SET organization_id = '00000000-0000-0000-0000-000000000001' 
WHERE organization_id IS NULL;

-- Atualizar restrição de unicidade para (organization_id, key)
ALTER TABLE public.whatsapp_bot_settings 
DROP CONSTRAINT IF EXISTS whatsapp_bot_settings_key_key;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_bot_settings_org_key'
    ) THEN
        ALTER TABLE public.whatsapp_bot_settings 
        ADD CONSTRAINT whatsapp_bot_settings_org_key UNIQUE (organization_id, key);
    END IF;
END $$;

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_whatsapp_bot_settings_org ON public.whatsapp_bot_settings(organization_id);

-- Atualizar políticas RLS em whatsapp_bot_settings
ALTER TABLE public.whatsapp_bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_whatsapp_settings" ON public.whatsapp_bot_settings;
DROP POLICY IF EXISTS "admin_all_whatsapp_settings" ON public.whatsapp_bot_settings;
DROP POLICY IF EXISTS "all_whatsapp_bot_settings" ON public.whatsapp_bot_settings;

CREATE POLICY "all_whatsapp_bot_settings" ON public.whatsapp_bot_settings
FOR ALL TO authenticated USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
) WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR (organization_id IS NOT NULL AND organization_id::text = (SELECT public.get_user_org_id())::text)
);

-- 2. Tabela: cupons (Garantir organization_id)
ALTER TABLE public.cupons 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.cupons 
SET organization_id = '00000000-0000-0000-0000-000000000001' 
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cupons_org ON public.cupons(organization_id);

-- 3. Tabela: whatsapp_message_queue (Garantir organization_id e índice)
ALTER TABLE public.whatsapp_message_queue 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.whatsapp_message_queue 
SET organization_id = '00000000-0000-0000-0000-000000000001' 
WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_org ON public.whatsapp_message_queue(organization_id);

-- 4. Notificar PostgREST
NOTIFY pgrst, 'reload schema';
