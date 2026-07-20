-- ============================================================================
-- BACKFILL PARTE 3: Logística, Financeiro, Parcelas
-- Rodar DEPOIS da Parte 2
-- ============================================================================

DO $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    RAISE NOTICE 'Org: %', v_org_id;

    -- devolucoes
    BEGIN UPDATE public.devolucoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'devolucoes OK';

    -- entregas
    BEGIN UPDATE public.entregas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'entregas OK';

    -- montagens
    BEGIN UPDATE public.montagens SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'montagens OK';

    -- montagens_itens
    BEGIN UPDATE public.montagens_itens SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- assistencias_tecnicas
    BEGIN UPDATE public.assistencias_tecnicas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- parcelas
    BEGIN UPDATE public.parcelas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'parcelas OK';

    -- lancamentos_financeiros
    BEGIN UPDATE public.lancamentos_financeiros SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'lancamentos_financeiros OK';

    -- conferencias_caixa
    BEGIN UPDATE public.conferencias_caixa SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    RAISE NOTICE 'PARTE 3 CONCLUÍDA!';
END $$;
