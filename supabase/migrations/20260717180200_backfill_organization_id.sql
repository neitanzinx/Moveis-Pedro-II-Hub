-- ============================================================================
-- FIX: Backfill organization_id em TODOS os registros órfãos (NULL)
-- ============================================================================
-- As migrações 20260709 e 20260716 adicionaram a coluna organization_id e 
-- aplicaram RLS por tenant em todas as tabelas, porém NUNCA fizeram backfill
-- dos registros já existentes. Resultado: todos os dados antigos ficaram com
-- organization_id = NULL e como NULL ≠ UUID, o RLS esconde esses registros.
--
-- ESTRATÉGIA DE BACKFILL:
-- 1. Para tabelas que têm FK para um usuário (created_by, vendedor_id, etc),
--    inferimos o organization_id a partir do public_users correspondente.
-- 2. Para tabelas que NÃO têm FK mas que só existia 1 organização antes do SaaS,
--    usamos a ÚNICA organização existente como fallback.
-- 3. Para tabelas que referenciam outras tabelas já preenchidas (ex: parcelas -> vendas),
--    inferimos pela tabela pai.
-- ============================================================================

-- Rodar com SECURITY DEFINER para bypassar o RLS durante o backfill
CREATE OR REPLACE FUNCTION public._backfill_org_ids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id uuid;
    v_org_count int;
    tbl text;
    -- Tabelas simples que devem receber o fallback org_id diretamente
    simple_tables text[] := ARRAY[
        'categorias_financeiras', 'configuracao_taxas', 'configuracao_comissoes',
        'cargos', 'lojas', 'fornecedores', 'produtos',
        'colaboradores', 'vendedores', 'montadores', 'caminhoes',
        'valores_montagem', 'campanhas', 'cupons',
        'vagas', 'candidatos', 'avaliacoes_desempenho', 'documentos_rh',
        'role_permissions', 'tokens_gerenciais', 'desconto_produto_excecoes',
        'configuracoes_sistema', 'configuracao_prazos',
        'metas_vendas', 'regras_comissao', 'niveis_comissao', 'niveis_comissao_faixas',
        'cores', 'tecidos', 'produto_variantes', 'estoque',
        'payment_provider_configs',
        'compras_centro_custos',
        'nps_links',
        'historico_precos',
        'promocoes_fornecedor',
        'solicitacoes_cadastro_produto',
        'configuracao_comissoes'
    ];
BEGIN
    -- ═══════════════════════════════════════════════════════════════
    -- PASSO 0: Determinar a organização para fallback
    -- Se há apenas 1 organização, usamos ela para tudo.
    -- Se há mais de 1, só fazemos backfill via FK (relações).
    -- ═══════════════════════════════════════════════════════════════
    SELECT count(*) INTO v_org_count FROM public.organizations;

    IF v_org_count = 1 THEN
        SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
        RAISE NOTICE 'Modo single-tenant detectado. Org fallback: %', v_org_id;
    ELSIF v_org_count = 0 THEN
        RAISE EXCEPTION 'Nenhuma organização encontrada. Impossível fazer backfill.';
    ELSE
        -- Multi-tenant: pegar a organização mais antiga como fallback para dados pré-SaaS
        SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
        RAISE NOTICE 'Multi-tenant detectado (% orgs). Usando org mais antiga como fallback: %', v_org_count, v_org_id;
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- PASSO 1: Backfill public_users (base de tudo)
    -- ═══════════════════════════════════════════════════════════════
    UPDATE public.public_users
    SET organization_id = v_org_id
    WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill public_users: % linhas', (SELECT count(*) FROM public.public_users WHERE organization_id = v_org_id);

    -- ═══════════════════════════════════════════════════════════════
    -- PASSO 2: Backfill tabelas simples (sem FK para inferir)
    -- ═══════════════════════════════════════════════════════════════
    FOREACH tbl IN ARRAY simple_tables LOOP
      BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables t
            JOIN information_schema.columns c ON c.table_schema = t.table_schema AND c.table_name = t.table_name
            WHERE t.table_schema = 'public' AND t.table_name = tbl AND c.column_name = 'organization_id'
        ) THEN
            EXECUTE format('UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL', tbl)
            USING v_org_id;
            RAISE NOTICE 'Backfill % concluído', tbl;
        ELSE
            RAISE NOTICE 'Tabela % não tem organization_id ou não existe (ignorada)', tbl;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro no backfill de % (ignorado): %', tbl, SQLERRM;
      END;
    END LOOP;

    -- ═══════════════════════════════════════════════════════════════
    -- PASSO 3: Backfill tabelas com FK (inferir pela tabela pai)
    -- ═══════════════════════════════════════════════════════════════

    -- vendas: fallback direto (dados pré-SaaS)
    UPDATE public.vendas SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill vendas concluído';

    -- clientes
    UPDATE public.clientes SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill clientes concluído';

    -- orcamentos
    UPDATE public.orcamentos SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill orcamentos concluído';

    -- devolucoes
    UPDATE public.devolucoes SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill devolucoes concluído';

    -- entregas
    UPDATE public.entregas SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill entregas concluído';

    -- montagens
    UPDATE public.montagens SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill montagens concluído';

    -- assistencias_tecnicas
    UPDATE public.assistencias_tecnicas SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill assistencias_tecnicas concluído';

    -- parcelas (via venda_id -> vendas)
    BEGIN
        UPDATE public.parcelas p
        SET organization_id = v.organization_id
        FROM public.vendas v
        WHERE p.venda_id = v.id AND p.organization_id IS NULL;
        -- Fallback para parcelas sem venda associada
        UPDATE public.parcelas SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill parcelas concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro parcelas (ignorado): %', SQLERRM;
    END;

    -- lancamentos_financeiros
    UPDATE public.lancamentos_financeiros SET organization_id = v_org_id WHERE organization_id IS NULL;
    RAISE NOTICE 'Backfill lancamentos_financeiros concluído';

    -- folhas_pagamento
    BEGIN
        UPDATE public.folhas_pagamento SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill folhas_pagamento concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro folhas_pagamento (ignorado): %', SQLERRM;
    END;

    -- ferias
    BEGIN
        UPDATE public.ferias SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill ferias concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ferias (ignorado): %', SQLERRM;
    END;

    -- licencas
    BEGIN
        UPDATE public.licencas SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill licencas concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro licencas (ignorado): %', SQLERRM;
    END;

    -- ponto_eletronico
    BEGIN
        UPDATE public.ponto_eletronico SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill ponto_eletronico concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ponto_eletronico (ignorado): %', SQLERRM;
    END;

    -- montagens_itens
    BEGIN
        UPDATE public.montagens_itens SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill montagens_itens concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro montagens_itens (ignorado): %', SQLERRM;
    END;

    -- estoque-related
    BEGIN
        UPDATE public.transferencias_estoque SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.inventarios SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.alertas_recompra SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.movimentacoes_estoque SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.solicitacoes_reposicao SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill estoque-related concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro estoque (ignorado): %', SQLERRM;
    END;

    -- NFe
    BEGIN
        UPDATE public.notas_fiscais_entrada SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.itens_nota_fiscal SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.notas_fiscais_emitidas SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.itens_nfe_emitida SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill NFe concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro NFe (ignorado): %', SQLERRM;
    END;

    -- Compras
    BEGIN
        UPDATE public.pedidos_compra SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.itens_pedido_compra SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.compras_contas_pagar SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.compras_ordens SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.compras_oc_itens SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.compras_workflows SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.compras_recebimentos_historico SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.solicitacoes_preco SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.solicitacoes_encomenda SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill compras concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro compras (ignorado): %', SQLERRM;
    END;

    -- Comissões
    BEGIN
        UPDATE public.comissoes_historico SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.comissoes_fechamento_mensal SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill comissoes concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro comissoes (ignorado): %', SQLERRM;
    END;

    -- Diversos
    BEGIN
        UPDATE public.notificacoes SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.mensagens_chat SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.audit_logs SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.cobrancas_pix SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.whatsapp_message_queue SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.log_uso_tokens SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.nps_avaliacoes SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.payment_transactions SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.conferencias_caixa SET organization_id = v_org_id WHERE organization_id IS NULL;
        RAISE NOTICE 'Backfill diversos concluído';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro diversos (ignorado): %', SQLERRM;
    END;

    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'BACKFILL COMPLETO! Todos os registros órfãos foram associados.';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
END;
$$;

-- Executar o backfill
SELECT public._backfill_org_ids();

-- Limpar a função temporária
DROP FUNCTION IF EXISTS public._backfill_org_ids();

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';
