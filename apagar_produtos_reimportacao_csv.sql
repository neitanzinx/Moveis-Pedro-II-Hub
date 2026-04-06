-- ============================================================
-- Apagar produtos para reimportacao de CSV
-- Data: 2026-04-06
-- Objetivo: excluir produtos e registros dependentes antes de reimportar
-- ============================================================
-- Modo seguro padrao:
-- - delete_all_organizations = false: apaga apenas a organization_id alvo
-- - delete_all_organizations = true: apaga produtos de todas as organizacoes
--
-- IMPORTANTE: este script remove dados de produtos de forma irreversivel.
-- ============================================================

BEGIN;

DO $$
DECLARE
  has_org_column BOOLEAN;
  delete_all_organizations BOOLEAN := false;
  target_org_id TEXT := '00000000-0000-0000-0000-000000000001';
  deleted_dependents BIGINT := 0;
  deleted_products BIGINT := 0;
  affected_rows BIGINT := 0;
  rel RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'produtos'
      AND column_name = 'organization_id'
  ) INTO has_org_column;

  IF has_org_column AND NOT delete_all_organizations THEN
    CREATE TEMP TABLE tmp_produtos_alvo ON COMMIT DROP AS
    SELECT id
    FROM public.produtos
    WHERE organization_id = target_org_id;
  ELSE
    CREATE TEMP TABLE tmp_produtos_alvo ON COMMIT DROP AS
    SELECT id
    FROM public.produtos;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tmp_produtos_alvo) THEN
    RAISE NOTICE 'Nenhum produto encontrado para exclusao (escopo selecionado).';
    RETURN;
  END IF;

  -- Apaga primeiro nas tabelas filhas com FK para produtos(id)
  FOR rel IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.produtos'::regclass
      AND array_length(con.conkey, 1) = 1
      AND n.nspname = 'public'
      AND c.relname <> 'produtos'
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE %I IN (SELECT id FROM tmp_produtos_alvo)',
      rel.schema_name,
      rel.table_name,
      rel.column_name
    );

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    deleted_dependents := deleted_dependents + affected_rows;
  END LOOP;

  -- Apaga os proprios produtos (auto-relacionamentos ja ficam cobertos)
  DELETE FROM public.produtos
  WHERE id IN (SELECT id FROM tmp_produtos_alvo);

  GET DIAGNOSTICS deleted_products = ROW_COUNT;

  RAISE NOTICE 'Dependencias removidas: %', deleted_dependents;
  RAISE NOTICE 'Produtos removidos: %', deleted_products;
END $$;

-- Verificacao final
SELECT COUNT(*) AS produtos_restantes FROM public.produtos;

COMMIT;
