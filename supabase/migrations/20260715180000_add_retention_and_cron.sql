-- 1. Adicionar coluna deleted_at
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Função para agendar exclusão (Soft Delete temporário)
CREATE OR REPLACE FUNCTION public.schedule_organization_deletion(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_saas_operator() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    UPDATE public.organizations 
    SET 
        deleted_at = now(),
        status_assinatura = 'cancelada'
    WHERE id = p_org_id;
END;
$$;

-- 3. Função para restaurar organização
CREATE OR REPLACE FUNCTION public.restore_organization(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_saas_operator() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    UPDATE public.organizations 
    SET 
        deleted_at = NULL,
        status_assinatura = 'ativa'
    WHERE id = p_org_id;
END;
$$;

-- 4. Configurar pg_cron para limpeza automática (Hard Delete)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Remove o job antigo se existir para não duplicar
DO $$
BEGIN
  PERFORM cron.unschedule('purge_old_organizations');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar erros se o job não existir
END $$;

-- Agenda para rodar todo dia à meia-noite (0 0 * * *)
SELECT cron.schedule(
  'purge_old_organizations',
  '0 0 * * *',
  $$
    SELECT public.hard_delete_organization(id) 
    FROM public.organizations 
    WHERE deleted_at <= now() - interval '90 days'
  $$
);
