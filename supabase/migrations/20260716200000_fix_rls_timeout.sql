-- ============================================================================
-- FIX: Recursão infinita em public_users + timeout em tabelas grandes
-- ============================================================================

-- 1. Restaurar SECURITY DEFINER na função (necessário para evitar recursão)
--    Quando a política de public_users chama get_user_org_id(), a função
--    precisa acessar public_users SEM passar pelo RLS novamente.
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.public_users WHERE id = auth.uid();
$$;

-- 2. Recriar TODAS as políticas _isolated usando (SELECT get_user_org_id())
--    O truque do (SELECT ...) força o PostgreSQL a avaliar a função UMA vez
--    por query (InitPlan) em vez de uma vez por LINHA. Isso elimina o timeout.
CREATE OR REPLACE FUNCTION public._rebuild_all_isolated_policies()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    tbl text;
    policy_name text;
    tables_to_fix text[] := ARRAY[
      'public_users', 'vendas', 'clientes', 'produtos', 'fornecedores',
      'orcamentos', 'lojas', 'cargos', 'devolucoes', 'entregas',
      'montagens', 'assistencias_tecnicas',
      'parcelas', 'lancamentos_financeiros', 'categorias_financeiras',
      'configuracao_taxas', 'configuracao_comissoes',
      'colaboradores', 'folhas_pagamento', 'ferias', 'licencas',
      'vagas', 'candidatos', 'avaliacoes_desempenho', 'documentos_rh',
      'ponto_eletronico',
      'vendedores', 'campanhas', 'cupons', 'valores_montagem',
      'montadores', 'montagens_itens',
      'transferencias_estoque', 'inventarios', 'alertas_recompra',
      'movimentacoes_estoque', 'solicitacoes_reposicao',
      'notas_fiscais_entrada', 'itens_nota_fiscal',
      'notas_fiscais_emitidas', 'itens_nfe_emitida',
      'pedidos_compra', 'itens_pedido_compra', 'compras_contas_pagar',
      'solicitacoes_preco', 'solicitacoes_encomenda',
      'compras_ordens', 'compras_oc_itens', 'compras_centro_custos',
      'compras_workflows', 'compras_recebimentos_historico',
      'solicitacoes_cadastro_produto', 'promocoes_fornecedor',
      'historico_precos',
      'caminhoes', 'notificacoes', 'mensagens_chat', 'audit_logs',
      'role_permissions', 'cobrancas_pix', 'whatsapp_message_queue',
      'metas_vendas', 'regras_comissao', 'comissoes_historico',
      'comissoes_fechamento_mensal', 'niveis_comissao',
      'niveis_comissao_faixas', 'tokens_gerenciais',
      'desconto_produto_excecoes', 'log_uso_tokens',
      'nps_links', 'nps_avaliacoes',
      'payment_provider_configs', 'payment_transactions',
      'cores', 'tecidos', 'produto_variantes', 'estoque',
      'conferencias_caixa', 'configuracoes_sistema', 'configuracao_prazos'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_fix LOOP
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          policy_name := tbl || '_isolated';
          
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl);
          
          -- (SELECT public.get_user_org_id()) = InitPlan = avaliado 1x por query
          EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (
              auth.jwt() ->> ''role'' = ''service_role'' 
              OR organization_id = (SELECT public.get_user_org_id())
            ) WITH CHECK (
              auth.jwt() ->> ''role'' = ''service_role'' 
              OR organization_id = (SELECT public.get_user_org_id())
            )',
            policy_name, tbl
          );
          
          RAISE NOTICE 'Política recriada com InitPlan: %', tbl;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro em % (ignorado): %', tbl, SQLERRM;
      END;
    END LOOP;
END;
$$;

SELECT public._rebuild_all_isolated_policies();
DROP FUNCTION IF EXISTS public._rebuild_all_isolated_policies();

-- 3. Criar índices em organization_id para tabelas grandes sem índice
DO $$
DECLARE
    tbl text;
    idx_name text;
    tables_needing_idx text[] := ARRAY[
      'vendas', 'clientes', 'audit_logs', 'lancamentos_financeiros',
      'parcelas', 'entregas', 'montagens', 'devolucoes',
      'alertas_recompra', 'movimentacoes_estoque',
      'notas_fiscais_entrada', 'notas_fiscais_emitidas',
      'compras_ordens', 'assistencias_tecnicas',
      'public_users'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_needing_idx LOOP
      BEGIN
        idx_name := 'idx_' || tbl || '_org_id';
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = tbl AND indexname = idx_name) THEN
            EXECUTE format('CREATE INDEX %I ON public.%I (organization_id)', idx_name, tbl);
            RAISE NOTICE 'Índice criado: %', idx_name;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao criar índice em % (ignorado): %', tbl, SQLERRM;
      END;
    END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';
