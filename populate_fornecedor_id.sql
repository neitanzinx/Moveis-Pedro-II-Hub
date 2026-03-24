-- Script para popular fornecedor_id baseado em fornecedor_nome
-- Verifica cada produto sem fornecedor_id mas com fornecedor_nome preenchido
-- e associa o ID do fornecedor correspondente

-- 1. Visualizar quantos produtos serão atualizados
SELECT COUNT(*) as produtos_sem_fornecedor_id
FROM produtos
WHERE fornecedor_id IS NULL
  AND fornecedor_nome IS NOT NULL
  AND fornecedor_nome::text != '';

-- 2. Atualizar produtos associando com o fornecedor_id baseado no nome
UPDATE produtos p
SET fornecedor_id = f.id
FROM fornecedores f
WHERE p.fornecedor_id IS NULL
  AND p.fornecedor_nome IS NOT NULL
  AND p.fornecedor_nome::text != ''
  AND LOWER(TRIM(f.nome_empresa)) = LOWER(TRIM(p.fornecedor_nome));

-- 3. Verificar quantos ficaram sem match (nome do fornecedor não existe na tabela)
SELECT COUNT(*) as produtos_sem_match_encontrado
FROM produtos
WHERE fornecedor_id IS NULL
  AND fornecedor_nome IS NOT NULL
  AND fornecedor_nome::text != '';

-- 4. Visualizar quais fornecedores não foram encontrados na base
SELECT DISTINCT fornecedor_nome
FROM produtos
WHERE fornecedor_id IS NULL
  AND fornecedor_nome IS NOT NULL
  AND fornecedor_nome::text != ''
ORDER BY fornecedor_nome;

-- 5. Para os sem match, você pode:
-- Opção A: Criar os fornecedores automaticamente
INSERT INTO fornecedores (nome_empresa, ativo)
SELECT DISTINCT
  TRIM(p.fornecedor_nome),
  true
FROM produtos p
WHERE p.fornecedor_id IS NULL
  AND p.fornecedor_nome IS NOT NULL
  AND p.fornecedor_nome::text != ''
  AND NOT EXISTS (
    SELECT 1 FROM fornecedores f
    WHERE LOWER(TRIM(f.nome_empresa)) = LOWER(TRIM(p.fornecedor_nome))
  )
ON CONFLICT DO NOTHING;

-- 6. Depois de criar, rodar o UPDATE novamente (passo 2)
UPDATE produtos p
SET fornecedor_id = f.id
FROM fornecedores f
WHERE p.fornecedor_id IS NULL
  AND p.fornecedor_nome IS NOT NULL
  AND p.fornecedor_nome::text != ''
  AND LOWER(TRIM(f.nome_empresa)) = LOWER(TRIM(p.fornecedor_nome));

-- 7. Verificar resultado final
SELECT COUNT(*) as total_produtos,
       COUNT(CASE WHEN fornecedor_id IS NOT NULL THEN 1 END) as com_fornecedor_id,
       COUNT(CASE WHEN fornecedor_id IS NULL THEN 1 END) as sem_fornecedor_id
FROM produtos;
