-- Limpeza de histórico de preços inválido
-- Objetivo: manter apenas itens realmente comprados via OC.
--
-- Critérios de remoção:
-- 1) Sem vínculo com OC (numero_oc nulo ou vazio)
-- 2) Sem produto associado (produto_id nulo)
--
-- Execute este script no SQL Editor do Supabase.

BEGIN;

-- Prévia: total de registros antes
SELECT COUNT(*) AS total_antes
FROM historico_precos;

-- Prévia: registros que serão removidos
SELECT COUNT(*) AS total_invalidos
FROM historico_precos hp
WHERE hp.numero_oc IS NULL
   OR BTRIM(hp.numero_oc) = ''
   OR hp.produto_id IS NULL;

-- Limpeza
DELETE FROM historico_precos hp
WHERE hp.numero_oc IS NULL
   OR BTRIM(hp.numero_oc) = ''
   OR hp.produto_id IS NULL;

-- Validação pós-limpeza
SELECT COUNT(*) AS total_depois
FROM historico_precos;

SELECT COUNT(*) AS total_invalidos_restantes
FROM historico_precos hp
WHERE hp.numero_oc IS NULL
   OR BTRIM(hp.numero_oc) = ''
   OR hp.produto_id IS NULL;

COMMIT;
