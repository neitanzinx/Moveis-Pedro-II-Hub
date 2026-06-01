-- Corrige inconsistencias historicas entre configuracao_taxa e configuracao_taxas
-- e garante a coluna desconto_vendedor para calculo do liquido do vendedor.

DO $$
BEGIN
  IF to_regclass('public.configuracao_taxas') IS NOT NULL THEN
    ALTER TABLE public.configuracao_taxas
      ADD COLUMN IF NOT EXISTS desconto_vendedor numeric(10,2) DEFAULT 0;

    COMMENT ON COLUMN public.configuracao_taxas.desconto_vendedor IS
      'Percentual descontado do valor da venda para calcular o liquido do vendedor (base para comissao manual)';
  END IF;

  IF to_regclass('public.configuracao_taxa') IS NOT NULL THEN
    ALTER TABLE public.configuracao_taxa
      ADD COLUMN IF NOT EXISTS desconto_vendedor numeric(10,2) DEFAULT 0;

    COMMENT ON COLUMN public.configuracao_taxa.desconto_vendedor IS
      'Percentual descontado do valor da venda para calcular o liquido do vendedor (base para comissao manual)';
  END IF;
END
$$;

-- Solicita refresh do cache de schema do PostgREST (quando aplicavel)
NOTIFY pgrst, 'reload schema';
