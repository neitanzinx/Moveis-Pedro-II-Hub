-- Correcao de encomendas antigas sem loja_id (foco: Loja Centro)
-- Seguro para executar mais de uma vez (idempotente)

-- 1) Diagnostico antes
SELECT
  COUNT(*) AS total_sem_loja_id,
  COUNT(*) FILTER (WHERE lower(trim(coalesce(loja, ''))) = 'centro') AS total_sem_loja_id_centro
FROM solicitacoes_encomenda
WHERE loja_id IS NULL;

-- 2) Atualizacao
DO $$
DECLARE
  v_loja_centro_id uuid;
  v_atualizadas_por_venda integer := 0;
  v_atualizadas_por_texto integer := 0;
BEGIN
  -- Resolve o ID da loja Centro
  SELECT l.id
    INTO v_loja_centro_id
  FROM lojas l
  WHERE lower(trim(l.nome)) = 'centro'
  ORDER BY l.created_at NULLS LAST, l.id
  LIMIT 1;

  IF v_loja_centro_id IS NULL THEN
    RAISE EXCEPTION 'Loja Centro nao encontrada na tabela lojas.';
  END IF;

  -- Passo A: preencher loja_id usando a venda relacionada (mais confiavel)
  UPDATE solicitacoes_encomenda se
     SET loja_id = v.loja_id
    FROM vendas v
   WHERE se.loja_id IS NULL
     AND se.venda_id IS NOT NULL
     AND v.loja_id IS NOT NULL
     AND se.venda_id::text = v.id::text
     AND (
       lower(trim(coalesce(se.loja, ''))) = 'centro'
       OR lower(trim(coalesce(v.loja, ''))) = 'centro'
     );

  GET DIAGNOSTICS v_atualizadas_por_venda = ROW_COUNT;

  -- Passo B: fallback para registros ainda sem loja_id marcados como Centro
  UPDATE solicitacoes_encomenda se
     SET loja_id = v_loja_centro_id
   WHERE se.loja_id IS NULL
     AND lower(trim(coalesce(se.loja, ''))) = 'centro';

  GET DIAGNOSTICS v_atualizadas_por_texto = ROW_COUNT;

  RAISE NOTICE 'Atualizadas por venda: %', v_atualizadas_por_venda;
  RAISE NOTICE 'Atualizadas por texto da loja: %', v_atualizadas_por_texto;
END $$;

-- 3) Diagnostico depois
SELECT
  COUNT(*) AS total_sem_loja_id,
  COUNT(*) FILTER (WHERE lower(trim(coalesce(loja, ''))) = 'centro') AS total_sem_loja_id_centro
FROM solicitacoes_encomenda
WHERE loja_id IS NULL;

-- 4) Conferencia rapida das ultimas encomendas da loja Centro
SELECT
  se.id,
  se.numero_pedido,
  se.produto_nome,
  se.quantidade,
  se.loja,
  se.loja_id,
  se.status,
  se.created_at
FROM solicitacoes_encomenda se
LEFT JOIN lojas l ON l.id = se.loja_id
WHERE lower(trim(coalesce(se.loja, l.nome, ''))) = 'centro'
ORDER BY se.created_at DESC
LIMIT 50;
