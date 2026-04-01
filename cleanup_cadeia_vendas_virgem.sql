-- =============================================================
-- LIMPEZA COMPLETA DA CADEIA DE VENDAS (SISTEMA VIRGEM)
-- =============================================================
-- Objetivo:
--   Remover historico de vendas e tudo que a cadeia delas pode gerar
--   (entregas, montagens, devolucoes e tabelas dependentes).
--
-- O script:
--   1) Detecta automaticamente tabelas dependentes por FK (direta/indireta)
--      a partir de: vendas, orcamentos, entregas, montagens, devolucoes.
--   2) Inclui tabelas comerciais sem FK direta comuns no projeto.
--   3) Executa TRUNCATE ... RESTART IDENTITY CASCADE.
--
-- ATENCAO:
--   Este script APAGA DADOS. Rode em ambiente correto.
-- =============================================================

BEGIN;

DO $$
DECLARE
    v_roots text[] := ARRAY[
        'vendas',
        'orcamentos',
        'entregas',
        'montagens',
        'devolucoes'
    ];

    -- Tabelas comerciais/historicas que podem nao estar ligadas por FK
    -- direta, mas normalmente fazem parte da cadeia de vendas.
    v_extras text[] := ARRAY[
        'montagens_itens',
        'parcelas',
        'lancamentos_financeiros',
        'cobrancas_pix',
        'payment_links',
        'stone_webhooks',
        'assistencias_tecnicas',
        'comissoes_historico',
        'comissoes_fechamento_mensal',
        'nps_links',
        'nps_avaliacoes',
        'notificacoes',
        'whatsapp_message_queue',
        'solicitacoes_encomenda',
        'audit_logs'
    ];

    v_existing_roots text[];
    v_targets text[];
    v_sql text;
BEGIN
    -- Mantem somente roots que existem de fato no schema public.
    SELECT COALESCE(array_agg(r), '{}'::text[])
      INTO v_existing_roots
      FROM unnest(v_roots) AS r
     WHERE to_regclass(format('public.%I', r)) IS NOT NULL;

    IF array_length(v_existing_roots, 1) IS NULL THEN
        RAISE EXCEPTION
            'Nenhuma tabela raiz encontrada em public (esperado: vendas/orcamentos/entregas/montagens/devolucoes).';
    END IF;

    WITH RECURSIVE fk_tree AS (
        -- Filhos diretos das tabelas raiz
        SELECT child.relname AS table_name
          FROM pg_constraint c
          JOIN pg_class child       ON child.oid = c.conrelid
          JOIN pg_namespace nchild  ON nchild.oid = child.relnamespace
          JOIN pg_class parent      ON parent.oid = c.confrelid
          JOIN pg_namespace nparent ON nparent.oid = parent.relnamespace
         WHERE c.contype = 'f'
           AND nchild.nspname = 'public'
           AND nparent.nspname = 'public'
           AND parent.relname = ANY (v_existing_roots)

        UNION

        -- Filhos indiretos (cadeia de dependencias)
        SELECT child2.relname AS table_name
          FROM pg_constraint c2
          JOIN pg_class child2       ON child2.oid = c2.conrelid
          JOIN pg_namespace nchild2  ON nchild2.oid = child2.relnamespace
          JOIN pg_class parent2      ON parent2.oid = c2.confrelid
          JOIN pg_namespace nparent2 ON nparent2.oid = parent2.relnamespace
          JOIN fk_tree ft            ON ft.table_name = parent2.relname
         WHERE c2.contype = 'f'
           AND nchild2.nspname = 'public'
           AND nparent2.nspname = 'public'
    ),
    candidates AS (
        SELECT unnest(v_existing_roots) AS table_name
        UNION
        SELECT table_name FROM fk_tree
        UNION
        SELECT e
          FROM unnest(v_extras) AS e
         WHERE to_regclass(format('public.%I', e)) IS NOT NULL
    )
    SELECT COALESCE(
               array_agg(format('public.%I', table_name) ORDER BY table_name),
               '{}'::text[]
           )
      INTO v_targets
      FROM (
          SELECT DISTINCT table_name
            FROM candidates
           WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
      ) t;

    IF array_length(v_targets, 1) IS NULL THEN
        RAISE EXCEPTION 'Nenhuma tabela alvo encontrada para limpeza.';
    END IF;

    RAISE NOTICE 'Tabelas que serao limpas: %', array_to_string(v_targets, ', ');

    v_sql :=
        'TRUNCATE TABLE ' || array_to_string(v_targets, ', ') || ' RESTART IDENTITY CASCADE';

    EXECUTE v_sql;
END
$$;

COMMIT;

-- =============================================================
-- VERIFICACAO RAPIDA (execute depois, se quiser conferir)
-- =============================================================
-- SELECT COUNT(*) AS vendas FROM public.vendas;
-- SELECT COUNT(*) AS entregas FROM public.entregas;
-- SELECT COUNT(*) AS montagens FROM public.montagens;
-- SELECT COUNT(*) AS devolucoes FROM public.devolucoes;
-- SELECT COUNT(*) AS orcamentos FROM public.orcamentos;
