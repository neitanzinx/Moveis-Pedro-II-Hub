-- ============================================================================
-- CORREÇÃO DA AUDITORIA E RETENÇÃO DE 7 DIAS
-- ============================================================================

-- 1. CORRIGIR O INSERTE DE LOGS (RLS VIOLATION)
-- Como a tabela audit_logs ganhou a coluna organization_id, os inserts do 
-- frontend começaram a ser bloqueados (pois mandavam organization_id = null).
-- Isso faz com que a coluna pegue a organização atual do usuário automaticamente.
ALTER TABLE public.audit_logs 
ALTER COLUMN organization_id SET DEFAULT public.get_user_org_id();

-- 2. GARANTIR A POLÍTICA DE LEITURA E ESCRITA
-- Caso a política tenha ficado muito restrita, recriamos para garantir
DROP POLICY IF EXISTS "Isolamento por organização" ON public.audit_logs;
CREATE POLICY "Isolamento por organização" ON public.audit_logs
FOR ALL TO authenticated
USING (organization_id = public.get_user_org_id())
WITH CHECK (organization_id = public.get_user_org_id());

-- 3. AGENDAR A LIMPEZA AUTOMÁTICA (MÁXIMO 7 DIAS)
-- Removemos o agendamento antigo se existir
DO $$ BEGIN PERFORM cron.unschedule('limpeza_diaria_audit_logs'); EXCEPTION WHEN OTHERS THEN END $$;

-- Agendamos para rodar todo dia à meia-noite (0 0 * * *)
SELECT cron.schedule('limpeza_diaria_audit_logs', '0 0 * * *', $$
    -- Deleta logs mais velhos que 7 dias
    DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Como roda de madrugada e a quantia apagada será pouca (apenas o que venceu no dia),
    -- o VACUUM puro (sem FULL) é suficiente para reaproveitar o espaço sem travar o banco.
    VACUUM public.audit_logs;
$$);
