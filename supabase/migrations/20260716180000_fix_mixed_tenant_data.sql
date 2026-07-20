-- ============================================================================
-- CORREÇÃO EMERGENCIAL: ISOLAMENTO MULTI-TENANT
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor > New Query)
-- Data: 2026-07-16
-- ============================================================================
-- 
-- PROBLEMA: Políticas RLS com USING(true) permitem que QUALQUER usuário 
-- autenticado veja dados de TODAS as organizações.
--
-- SOLUÇÃO: 
--   1. Remover TODAS as políticas permissivas (all_*, e qualquer outra USING(true))
--   2. Recriar políticas de isolamento por organization_id
--   3. Adicionar organization_id onde estiver faltando
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 1: Garantir que a função helper existe                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.public_users WHERE id = auth.uid();
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 2: Remover TODAS as políticas permissivas (varredura dinâmica)    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND policyname LIKE 'all_%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Removida política permissiva: %.% -> %', pol.schemaname, pol.tablename, pol.policyname;
    END LOOP;
END
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 3: Adicionar organization_id nas tabelas que ainda não têm       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
    tbl text;
    tables_needing_org_id text[] := ARRAY[
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
      'conferencias_caixa', 'configuracoes_sistema', 'configuracao_prazos'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_needing_org_id LOOP
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) DEFAULT public.get_user_org_id()', tbl);
          RAISE NOTICE 'organization_id adicionado: %', tbl;
        ELSE
          RAISE NOTICE 'Tabela não encontrada (ignorada): %', tbl;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em % (ignorado): %', tbl, SQLERRM;
      END;
    END LOOP;
END
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 4: Criar políticas de isolamento em TODAS as tabelas              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public._apply_tenant_isolation(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  policy_name text := p_table || '_isolated';
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, p_table);
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR ALL USING (
      auth.jwt() ->> ''role'' = ''service_role'' OR organization_id = public.get_user_org_id()
    ) WITH CHECK (
      auth.jwt() ->> ''role'' = ''service_role'' OR organization_id = public.get_user_org_id()
    )',
    policy_name, p_table
  );
  RAISE NOTICE 'Isolamento aplicado: %', p_table;
END;
$$;

DO $$
DECLARE
    tbl text;
    tables_to_isolate text[] := ARRAY[
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
    FOREACH tbl IN ARRAY tables_to_isolate LOOP
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          PERFORM public._apply_tenant_isolation(tbl);
        ELSE
          RAISE NOTICE 'Tabela não encontrada (ignorada): %', tbl;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erro ao isolar tabela % (ignorado): %', tbl, SQLERRM;
      END;
    END LOOP;
END
$$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 5: Preservar acesso público para planos e organizações            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DROP POLICY IF EXISTS select_planos_anon ON public.planos;
CREATE POLICY select_planos_anon ON public.planos FOR SELECT TO anon USING (ativo = true);
DROP POLICY IF EXISTS select_planos_auth ON public.planos;
CREATE POLICY select_planos_auth ON public.planos FOR SELECT TO authenticated USING (true);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 6: Limpar e recarregar                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DROP FUNCTION IF EXISTS public._apply_tenant_isolation(text);
NOTIFY pgrst, 'reload schema';

-- FIM DA CORREÇÃO
