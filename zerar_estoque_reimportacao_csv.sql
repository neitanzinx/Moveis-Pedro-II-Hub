-- ============================================================
-- Zerar estoque para reimportacao de CSV
-- Data: 2026-04-06
-- Objetivo: limpar saldos atuais de produtos antes de nova importacao
-- ============================================================

BEGIN;

-- 1) Zera estoque principal com filtro multi-tenant quando disponivel
DO $$
DECLARE
  has_org_column BOOLEAN;
  has_reserved_column BOOLEAN;
  target_org_id TEXT := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'produtos'
      AND column_name = 'organization_id'
  ) INTO has_org_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'produtos'
      AND column_name = 'quantidade_reservada'
  ) INTO has_reserved_column;

  IF has_org_column THEN
    EXECUTE format(
      'UPDATE produtos
       SET quantidade_estoque = 0
       WHERE COALESCE(quantidade_estoque, 0) <> 0
         AND organization_id = %L',
      target_org_id
    );

    IF has_reserved_column THEN
      EXECUTE format(
        'UPDATE produtos
         SET quantidade_reservada = 0
         WHERE COALESCE(quantidade_reservada, 0) <> 0
           AND organization_id = %L',
        target_org_id
      );
    END IF;
  ELSE
    EXECUTE '
      UPDATE produtos
      SET quantidade_estoque = 0
      WHERE COALESCE(quantidade_estoque, 0) <> 0
    ';

    IF has_reserved_column THEN
      EXECUTE '
        UPDATE produtos
        SET quantidade_reservada = 0
        WHERE COALESCE(quantidade_reservada, 0) <> 0
      ';
    END IF;
  END IF;
END $$;

-- 3) Verificacao rapida
SELECT
  COUNT(*) AS total_produtos,
  SUM(CASE WHEN COALESCE(quantidade_estoque, 0) = 0 THEN 1 ELSE 0 END) AS produtos_com_estoque_zero,
  SUM(CASE WHEN COALESCE(quantidade_estoque, 0) > 0 THEN 1 ELSE 0 END) AS produtos_com_estoque_positivo
FROM produtos;

COMMIT;
