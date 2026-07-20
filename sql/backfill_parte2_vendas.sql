-- ============================================================================
-- BACKFILL PARTE 2: Produtos, Vendas, Clientes, Orçamentos
-- Rodar DEPOIS da Parte 1
-- ============================================================================

DO $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    RAISE NOTICE 'Org: %', v_org_id;

    -- produtos
    UPDATE public.produtos SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'produtos OK';

    -- produto_variantes
    BEGIN UPDATE public.produto_variantes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'produto_variantes OK';

    -- estoque
    BEGIN UPDATE public.estoque SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'estoque OK';

    -- historico_precos
    BEGIN UPDATE public.historico_precos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- desconto_produto_excecoes
    BEGIN UPDATE public.desconto_produto_excecoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- clientes
    UPDATE public.clientes SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'clientes OK';

    -- vendas
    UPDATE public.vendas SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'vendas OK';

    -- orcamentos
    UPDATE public.orcamentos SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'orcamentos OK';

    RAISE NOTICE 'PARTE 2 CONCLUÍDA!';
END $$;
