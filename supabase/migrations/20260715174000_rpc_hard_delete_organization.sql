-- Criação de Função Segura para Exclusão Definitiva de uma Empresa (Hard Delete)
-- Só pode ser chamada por Operadores SaaS e limpa TODAS as referências da empresa, incluindo os usuários da tabela auth.users.

CREATE OR REPLACE FUNCTION public.hard_delete_organization(p_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_is_operator BOOLEAN;
    v_user_id UUID;
BEGIN
    -- 1. Verificar permissões (Apenas operadores SaaS podem executar)
    v_is_operator := public.is_saas_operator();
    IF NOT v_is_operator THEN
        RAISE EXCEPTION 'Apenas Operadores SaaS podem realizar hard deletes de organizações.';
    END IF;

    -- Prevenir deleção acidental da organização padrão do sistema (se houver)
    IF p_org_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
        RAISE EXCEPTION 'Não é permitido excluir a organização principal do sistema.';
    END IF;

    -- 2. Apagar usuários do auth.users (O que limpará public_users via CASCADE se configurado, mas limparemos manualmente por segurança)
    -- Iterar sobre cada usuário pertencente à organização
    FOR v_user_id IN 
        SELECT id FROM public.public_users WHERE organization_id = p_org_id
    LOOP
        -- Se estiver rodando como superuser ou tiver grant no auth, isso funcionará.
        -- O Supabase permite SECURITY DEFINER alterar auth.users se a função for executada por admin (postgres)
        DELETE FROM auth.users WHERE id = v_user_id;
    END LOOP;

    -- 3. Limpar tabelas dependentes na ordem correta
    DELETE FROM public.assistencias_tecnicas WHERE organization_id = p_org_id;
    DELETE FROM public.montagens WHERE organization_id = p_org_id;
    DELETE FROM public.entregas WHERE organization_id = p_org_id;
    DELETE FROM public.devolucoes WHERE organization_id = p_org_id;
    
    DELETE FROM public.vendas WHERE organization_id = p_org_id;
    
    DELETE FROM public.produtos WHERE organization_id = p_org_id;
    DELETE FROM public.fornecedores WHERE organization_id = p_org_id;
    DELETE FROM public.orcamentos WHERE organization_id = p_org_id;
    DELETE FROM public.clientes WHERE organization_id = p_org_id;
    DELETE FROM public.lojas WHERE organization_id = p_org_id;
    DELETE FROM public.cargos WHERE organization_id = p_org_id;
    DELETE FROM public.public_users WHERE organization_id = p_org_id;
    
    -- Limpar tabelas de configurações e métricas SaaS
    DELETE FROM public.saas_tenant_daily_usage WHERE organization_id = p_org_id;
    DELETE FROM public.saas_fault_events WHERE organization_id = p_org_id;
    DELETE FROM public.organization_settings WHERE organization_id = p_org_id;

    -- 4. Excluir a própria organização
    DELETE FROM public.organizations WHERE id = p_org_id;

END;
$$;
