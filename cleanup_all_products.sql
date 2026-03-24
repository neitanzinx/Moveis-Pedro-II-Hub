-- Script para limpar TODOS os produtos e dados relacionados
-- CUIDADO: Isso vai deletar:
-- 1. Histórico de preços dos produtos
-- 2. Items de Ordem de Compra
-- 3. Produtos no estoque de lojas
-- 4. Os próprios produtos

-- COMEÇAR AQUI: Contar quantos produtos serão deletados
SELECT COUNT(*) as total_produtos FROM produtos;

-- Passo 1: Deletar histórico de preços
DELETE FROM historico_precos WHERE TRUE;
SELECT COUNT(*) as linhas_restantes FROM historico_precos;

-- Passo 2: Deletar items de OC
DELETE FROM compras_oc_itens WHERE TRUE;
SELECT COUNT(*) as linhas_restantes FROM compras_oc_itens;

-- Passo 3: Deletar estoque por loja (se existir essa tabela)
DELETE FROM estoque_loja WHERE TRUE;
SELECT COUNT(*) as linhas_restantes FROM estoque_loja;

-- Passo 4: Deletar todos os produtos
DELETE FROM produtos WHERE TRUE;
SELECT COUNT(*) as total_produtos_apos_delete FROM produtos;

-- Passo 5: Resetar sequences (auto-increment) se existir
ALTER SEQUENCE IF EXISTS produtos_id_seq RESTART WITH 1;

-- VERIFICAÇÃO FINAL
SELECT 
  (SELECT COUNT(*) FROM produtos) as total_produtos,
  (SELECT COUNT(*) FROM historico_precos) as total_historico,
  (SELECT COUNT(*) FROM compras_oc_itens) as total_oc_itens,
  (SELECT COUNT(*) FROM estoque_loja) as total_estoque_loja;
