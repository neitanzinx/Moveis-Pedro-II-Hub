-- ============================================================================
-- BACKFILL PARTE 1: Detectar org + public_users + tabelas pequenas
-- Rodar PRIMEIRO no SQL Editor do Supabase
-- ============================================================================

DO $$
DECLARE
    v_org_id uuid;
BEGIN
    -- Pegar a organização (a mais antiga se houver várias)
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma organização encontrada!';
    END IF;
    RAISE NOTICE 'Org: %', v_org_id;

    -- public_users
    UPDATE public.public_users SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'public_users OK';

    -- categorias_financeiras
    UPDATE public.categorias_financeiras SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'categorias_financeiras OK';

    -- configuracao_taxas
    BEGIN UPDATE public.configuracao_taxas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- configuracao_comissoes
    BEGIN UPDATE public.configuracao_comissoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- cargos
    BEGIN UPDATE public.cargos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- lojas
    BEGIN UPDATE public.lojas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- fornecedores
    BEGIN UPDATE public.fornecedores SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- colaboradores
    BEGIN UPDATE public.colaboradores SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- vendedores
    BEGIN UPDATE public.vendedores SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- montadores
    BEGIN UPDATE public.montadores SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- caminhoes
    BEGIN UPDATE public.caminhoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- valores_montagem
    BEGIN UPDATE public.valores_montagem SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- campanhas
    BEGIN UPDATE public.campanhas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- cupons
    BEGIN UPDATE public.cupons SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- role_permissions
    BEGIN UPDATE public.role_permissions SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- tokens_gerenciais
    BEGIN UPDATE public.tokens_gerenciais SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- configuracoes_sistema
    BEGIN UPDATE public.configuracoes_sistema SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- configuracao_prazos
    BEGIN UPDATE public.configuracao_prazos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- cores, tecidos
    BEGIN UPDATE public.cores SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.tecidos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE NOTICE 'PARTE 1 CONCLUÍDA!';
END $$;
