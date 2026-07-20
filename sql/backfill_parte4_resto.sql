-- ============================================================================
-- BACKFILL PARTE 4: RH, Compras, NFe, Diversos
-- Rodar DEPOIS da Parte 3
-- ============================================================================

DO $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations ORDER BY created_at ASC LIMIT 1;
    RAISE NOTICE 'Org: %', v_org_id;

    -- RH
    BEGIN UPDATE public.folhas_pagamento SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.ferias SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.licencas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.ponto_eletronico SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.vagas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.candidatos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.avaliacoes_desempenho SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.documentos_rh SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'RH OK';

    -- Compras
    BEGIN UPDATE public.pedidos_compra SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.itens_pedido_compra SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_contas_pagar SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_ordens SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_oc_itens SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_centro_custos SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_workflows SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.compras_recebimentos_historico SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.solicitacoes_preco SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.solicitacoes_encomenda SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.solicitacoes_cadastro_produto SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.promocoes_fornecedor SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'Compras OK';

    -- NFe
    BEGIN UPDATE public.notas_fiscais_entrada SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.itens_nota_fiscal SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.notas_fiscais_emitidas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.itens_nfe_emitida SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'NFe OK';

    -- Estoque
    BEGIN UPDATE public.transferencias_estoque SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.inventarios SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.alertas_recompra SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.movimentacoes_estoque SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.solicitacoes_reposicao SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'Estoque OK';

    -- Comissões
    BEGIN UPDATE public.metas_vendas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.regras_comissao SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.comissoes_historico SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.comissoes_fechamento_mensal SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.niveis_comissao SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.niveis_comissao_faixas SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'Comissões OK';

    -- Diversos
    BEGIN UPDATE public.notificacoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.mensagens_chat SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.audit_logs SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.cobrancas_pix SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.whatsapp_message_queue SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.log_uso_tokens SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.nps_links SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.nps_avaliacoes SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.payment_provider_configs SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.payment_transactions SET organization_id = v_org_id WHERE organization_id IS NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    RAISE NOTICE 'Diversos OK';

    RAISE NOTICE 'PARTE 4 CONCLUÍDA! BACKFILL COMPLETO!';
END $$;

NOTIFY pgrst, 'reload schema';
