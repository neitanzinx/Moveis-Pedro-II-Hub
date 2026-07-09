-- 1. Desativar plano essencial
UPDATE public.planos 
SET ativo = false 
WHERE slug = 'essencial';

-- 2. Adicionar políticas de RLS para operadores na tabela planos
DROP POLICY IF EXISTS insert_planos_operator ON public.planos;
CREATE POLICY insert_planos_operator ON public.planos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_operator());

DROP POLICY IF EXISTS update_planos_operator ON public.planos;
CREATE POLICY update_planos_operator ON public.planos
  FOR UPDATE TO authenticated
  USING (public.is_saas_operator());

-- O operador também precisa ler todos os planos (ativos e inativos)
DROP POLICY IF EXISTS select_planos_operator ON public.planos;
CREATE POLICY select_planos_operator ON public.planos
  FOR SELECT TO authenticated
  USING (public.is_saas_operator() OR ativo = true);

-- 3. Função segura (RPC) para realizar o Override Manual
CREATE OR REPLACE FUNCTION public.operator_override_subscription(
    p_org_id UUID,
    p_plano_id UUID,
    p_modulos JSONB,
    p_motivo TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_plano_id UUID;
    v_old_modulos JSONB;
BEGIN
    -- 1. Validar se o usuário que está chamando é um operador SaaS
    IF NOT public.is_saas_operator() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas operadores SaaS podem realizar override de assinaturas.';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
        RAISE EXCEPTION 'O motivo para o override é obrigatório.';
    END IF;

    -- 2. Pegar valores antigos para log (com lock FOR UPDATE para evitar race condition de concorrência)
    SELECT plano_id INTO v_old_plano_id 
    FROM public.organizations 
    WHERE id = p_org_id
    FOR UPDATE;

    SELECT modulos_ativos INTO v_old_modulos 
    FROM public.organization_settings 
    WHERE organization_id = p_org_id
    FOR UPDATE;

    -- CHECAGEM DE IDEMPOTÊNCIA (Evita auditoria duplicada e atualizações desnecessárias)
    IF v_old_plano_id = p_plano_id AND v_old_modulos = p_modulos THEN
        RETURN json_build_object('success', true, 'message', 'A assinatura já possui essas configurações.');
    END IF;

    -- 3. Atualizar o plano_id
    UPDATE public.organizations
    SET plano_id = p_plano_id
    WHERE id = p_org_id;

    -- 4. Atualizar os módulos ativos
    UPDATE public.organization_settings
    SET modulos_ativos = p_modulos,
        updated_at = NOW()
    WHERE organization_id = p_org_id;

    -- 5. Inserir no audit_logs
    -- Nota: assumimos que a tabela audit_logs possui table_name, action, record_id, old_data, new_data.
    -- O user_id que acionou fica no auth.uid() mas vamos colocar no new_data para garantir registro caso a tabela não tenha user_id.
    INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data)
    VALUES (
        'organizations',
        'manual_override_subscription',
        p_org_id::text,
        json_build_object('plano_id', v_old_plano_id, 'modulos_ativos', v_old_modulos),
        json_build_object(
            'plano_id', p_plano_id, 
            'modulos_ativos', p_modulos, 
            'motivo', p_motivo, 
            'operator_uid', auth.uid()
        )
    );

    RETURN json_build_object('success', true, 'message', 'Assinatura atualizada com sucesso pelo operador.');
END;
$$;
