-- Refatora a recorrencia financeira para tratar o lancamento como item comum
-- com automacao de proximas competencias baseada em vencimento.

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS recorrencia_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recorrencia_base_vencimento date,
  ADD COLUMN IF NOT EXISTS recorrencia_proxima_data date,
  ADD COLUMN IF NOT EXISTS recorrencia_ultima_geracao date,
  ADD COLUMN IF NOT EXISTS recorrencia_modelo_id bigint,
  ADD COLUMN IF NOT EXISTS recorrencia_competencia date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lancamentos_financeiros_recorrencia_modelo_id_fkey'
      AND conrelid = 'public.lancamentos_financeiros'::regclass
  ) THEN
    ALTER TABLE public.lancamentos_financeiros
      ADD CONSTRAINT lancamentos_financeiros_recorrencia_modelo_id_fkey
      FOREIGN KEY (recorrencia_modelo_id)
      REFERENCES public.lancamentos_financeiros(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill de categoria_nome para registros antigos sem categoria textual.
UPDATE public.lancamentos_financeiros lf
SET categoria_nome = cf.nome
FROM public.categorias_financeiras cf
WHERE lf.categoria_id = cf.id
  AND (lf.categoria_nome IS NULL OR btrim(lf.categoria_nome) = '');

-- Migra recorrencia legada para metadados de automacao.
WITH base AS (
  SELECT
    id,
    COALESCE(data_vencimento, data_lancamento) AS anchor_date,
    CASE COALESCE(recorrencia_tipo, 'Mensal')
      WHEN 'Semanal' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '7 days')::date
      WHEN 'Quinzenal' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '15 days')::date
      WHEN 'Mensal' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '1 month')::date
      WHEN 'Trimestral' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '3 months')::date
      WHEN 'Semestral' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '6 months')::date
      WHEN 'Anual' THEN (COALESCE(data_vencimento, data_lancamento) + INTERVAL '1 year')::date
      ELSE (COALESCE(data_vencimento, data_lancamento) + INTERVAL '1 month')::date
    END AS next_date
  FROM public.lancamentos_financeiros
  WHERE recorrente IS TRUE
)
UPDATE public.lancamentos_financeiros lf
SET
  recorrencia_ativa = TRUE,
  recorrencia_base_vencimento = base.anchor_date,
  recorrencia_proxima_data = COALESCE(lf.recorrencia_proxima_data, base.next_date)
FROM base
WHERE lf.id = base.id;

-- Para manter o comportamento atual e compatibilidade com telas legadas:
-- recorrente continua como flag funcional de automacao ativa.
UPDATE public.lancamentos_financeiros
SET recorrente = COALESCE(recorrente, false)
WHERE recorrente IS NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_recorrencia_ativa
  ON public.lancamentos_financeiros (recorrencia_ativa, data_vencimento)
  WHERE recorrencia_ativa = true;

CREATE INDEX IF NOT EXISTS idx_lancamentos_recorrencia_modelo
  ON public.lancamentos_financeiros (recorrencia_modelo_id, recorrencia_competencia);
