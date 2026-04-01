-- Migration: add_multi_roles_to_users
-- Objetivo: habilitar multiplos cargos por funcionario mantendo compatibilidade com campo legado `cargo`.

ALTER TABLE public_users
ADD COLUMN IF NOT EXISTS cargos TEXT[] DEFAULT '{}'::TEXT[];

ALTER TABLE colaboradores
ADD COLUMN IF NOT EXISTS cargos TEXT[] DEFAULT '{}'::TEXT[];

-- Backfill inicial: transforma cargo legado em array de um elemento quando vazio.
UPDATE public_users
SET cargos = ARRAY[cargo]
WHERE cargo IS NOT NULL
  AND cargo <> ''
  AND (cargos IS NULL OR array_length(cargos, 1) IS NULL);

UPDATE colaboradores
SET cargos = ARRAY[cargo]
WHERE cargo IS NOT NULL
  AND cargo <> ''
  AND (cargos IS NULL OR array_length(cargos, 1) IS NULL);

COMMENT ON COLUMN public_users.cargos IS 'Lista de cargos do usuario. Mantem compatibilidade com public_users.cargo durante transicao.';
COMMENT ON COLUMN colaboradores.cargos IS 'Lista de cargos do colaborador para sincronizacao com public_users.cargos.';
