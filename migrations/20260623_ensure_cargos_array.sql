-- Migration: ensure_cargos_array
-- Garante que a coluna cargos[] existe em public_users e colaboradores
-- e sincroniza o backfill a partir do campo legado `cargo`.

-- Garantir colunas (idempotente)
ALTER TABLE public_users   ADD COLUMN IF NOT EXISTS cargos TEXT[] DEFAULT '{}';
ALTER TABLE colaboradores  ADD COLUMN IF NOT EXISTS cargos TEXT[] DEFAULT '{}';

-- Backfill public_users: popular cargos[] onde ainda está vazio
UPDATE public_users
SET cargos = ARRAY[cargo]
WHERE cargo IS NOT NULL
  AND cargo <> ''
  AND (cargos IS NULL OR array_length(cargos, 1) IS NULL OR array_length(cargos, 1) = 0);

-- Backfill colaboradores
UPDATE colaboradores
SET cargos = ARRAY[cargo]
WHERE cargo IS NOT NULL
  AND cargo <> ''
  AND (cargos IS NULL OR array_length(cargos, 1) IS NULL OR array_length(cargos, 1) = 0);

-- Forçar atualização do schema cache da API
NOTIFY pgrst, reload schema;
