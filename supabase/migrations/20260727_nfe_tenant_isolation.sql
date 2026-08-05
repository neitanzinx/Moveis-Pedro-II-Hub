-- ============================================================================
-- MIGRAÇÃO: Isolamento multi-tenant para tabelas NFe adicionais
-- Data: 2026-07-27
-- ============================================================================
-- 
-- PROBLEMA: As tabelas nfe_eventos, nfe_carta_correcao e nfe_eventos_solicitacoes
-- não foram incluídas na migração de isolamento 20260716. Registros podem vazar
-- entre organizações.
--
-- SOLUÇÃO:
--   1. Adicionar organization_id onde está faltando
--   2. Aplicar RLS de isolamento por organization_id
--   3. Backfill organization_id nos registros existentes (inferir da venda)
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
-- ║ PASSO 2: Adicionar organization_id nas tabelas que faltam               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
    tbl text;
    tables_needing_org_id text[] := ARRAY[
      'nfe_eventos', 'nfe_carta_correcao', 'nfe_eventos_solicitacoes'
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
-- ║ PASSO 3: Backfill organization_id nos registros existentes              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- nfe_eventos: inferir da venda
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nfe_eventos') THEN
    UPDATE public.nfe_eventos e
    SET organization_id = v.organization_id
    FROM public.vendas v
    WHERE e.venda_id = v.id::text
      AND e.organization_id IS NULL
      AND v.organization_id IS NOT NULL;
    RAISE NOTICE 'Backfill nfe_eventos concluído';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro backfill nfe_eventos (ignorado): %', SQLERRM;
END
$$;

-- nfe_carta_correcao: inferir da nota → venda
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nfe_carta_correcao') THEN
    UPDATE public.nfe_carta_correcao cc
    SET organization_id = nfe.organization_id
    FROM public.notas_fiscais_emitidas nfe
    WHERE cc.nota_fiscal_id = nfe.id
      AND cc.organization_id IS NULL
      AND nfe.organization_id IS NOT NULL;
    RAISE NOTICE 'Backfill nfe_carta_correcao concluído';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro backfill nfe_carta_correcao (ignorado): %', SQLERRM;
END
$$;

-- nfe_eventos_solicitacoes: já tem organization_id no insert (gerir-evento-nfe)
-- mas backfill registros antigos via venda
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nfe_eventos_solicitacoes') THEN
    UPDATE public.nfe_eventos_solicitacoes s
    SET organization_id = v.organization_id
    FROM public.vendas v
    WHERE s.venda_id = v.id::text
      AND s.organization_id IS NULL
      AND v.organization_id IS NOT NULL;
    RAISE NOTICE 'Backfill nfe_eventos_solicitacoes concluído';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro backfill nfe_eventos_solicitacoes (ignorado): %', SQLERRM;
END
$$;

-- Fallback: para registros sem venda associável, usar a org padrão
DO $$
DECLARE
    v_org_id uuid;
    v_org_count int;
BEGIN
    SELECT COUNT(*) INTO v_org_count FROM public.organizations;
    IF v_org_count = 1 THEN
        SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
        
        UPDATE public.nfe_eventos SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.nfe_carta_correcao SET organization_id = v_org_id WHERE organization_id IS NULL;
        UPDATE public.nfe_eventos_solicitacoes SET organization_id = v_org_id WHERE organization_id IS NULL;
        
        RAISE NOTICE 'Fallback: registros órfãos associados à org %', v_org_id;
    ELSE
        RAISE NOTICE 'Múltiplas orgs encontradas — registros órfãos não podem ser backfillados automaticamente.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro fallback (ignorado): %', SQLERRM;
END
$$;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ PASSO 4: Aplicar RLS de isolamento                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $$
DECLARE
    tbl text;
    policy_name text;
    tables_to_isolate text[] := ARRAY[
      'nfe_eventos', 'nfe_carta_correcao', 'nfe_eventos_solicitacoes'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_isolate LOOP
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
          policy_name := tbl || '_isolated';
          
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
          
          -- Remover políticas antigas (all_* e *_isolated)
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'all_' || tbl, tbl);
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, tbl);
          
          -- Criar política de isolamento
          EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL USING (
              auth.jwt() ->> ''role'' = ''service_role'' OR organization_id = public.get_user_org_id()
            ) WITH CHECK (
              auth.jwt() ->> ''role'' = ''service_role'' OR organization_id = public.get_user_org_id()
            )',
            policy_name, tbl
          );
          
          RAISE NOTICE 'Isolamento aplicado: %', tbl;
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
-- ║ PASSO 5: Índices para performance                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_org_id ON public.nfe_eventos(organization_id);
CREATE INDEX IF NOT EXISTS idx_nfe_carta_correcao_org_id ON public.nfe_carta_correcao(organization_id);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_solicitacoes_org_id ON public.nfe_eventos_solicitacoes(organization_id);

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- FIM DA MIGRAÇÃO
