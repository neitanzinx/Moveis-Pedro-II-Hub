-- ==============================================
-- SCRIPT DE LIMPEZA - SISTEMA VIRGEM
-- Móveis Pedro II - Hub
-- ==============================================
-- ATENÇÃO: Este script apaga TODOS os dados de vendas,
-- entregas, montagens, orçamentos e devoluções!
-- Execute com cuidado.
-- ==============================================

-- 1. Primeiro apagar itens de montagem (dependem de entregas/vendas)
DELETE FROM montagens;

-- 2. Apagar entregas (dependem de vendas)
DELETE FROM entregas;

-- 3. Apagar devoluções (dependem de vendas)
DELETE FROM devolucoes;

-- 4. Apagar vendas
DELETE FROM vendas;

-- 5. Apagar orçamentos
DELETE FROM orcamentos;

-- ==============================================
-- VERIFICAÇÃO
-- Execute estas queries para confirmar que está vazio:
-- ==============================================
-- SELECT COUNT(*) FROM vendas;
-- SELECT COUNT(*) FROM entregas;
-- SELECT COUNT(*) FROM montagens;
-- SELECT COUNT(*) FROM orcamentos;
-- SELECT COUNT(*) FROM devolucoes;

-- ==============================================
-- LIMPAR APENAS MONTAGENS SOLTAS (sem apagar tudo)
-- Use este comando se só quiser limpar montagens órfãs:
-- ==============================================
-- DELETE FROM montagens WHERE entrega_id IS NULL;
-- DELETE FROM montagens WHERE venda_id IS NULL;

-- ==============================================
-- RESET TOTAL APP DE MONTAGENS (Zerar todas as montagens)
-- ==============================================
-- DELETE FROM montagens_itens;
-- DELETE FROM montagens;
