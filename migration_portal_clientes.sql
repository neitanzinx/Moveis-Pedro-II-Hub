-- =============================================================================
-- Migration: Portal do Cliente - Controle de Acesso Pago
-- Data: 2026-03-24
-- Descrição: Adiciona coluna portal_ativo para controlar acesso ao portal.
--            Somente clientes com portal_ativo = true conseguem usar o /area-cliente.
--            O administrador ativa manualmente após confirmação de pagamento.
-- =============================================================================

-- 1. Adicionar coluna à tabela clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS portal_ativo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN clientes.portal_ativo IS
  'Controla acesso ao Portal do Cliente (/area-cliente). '
  'Ativar manualmente para clientes pagantes via painel admin (Clientes > editar registro).';

-- 2. Manter clientes que eventualmente já tenham a flag ativa
-- (no-op se a coluna for nova, mas evita reset acidental)

-- =============================================================================
-- Como usar:
--   Ativar acesso de um cliente:
--     UPDATE clientes SET portal_ativo = TRUE WHERE id = '<uuid-do-cliente>';
--
--   Revogar acesso de um cliente:
--     UPDATE clientes SET portal_ativo = FALSE WHERE id = '<uuid-do-cliente>';
--
--   Listar clientes com acesso ativo:
--     SELECT id, nome_completo, email, portal_ativo FROM clientes WHERE portal_ativo = TRUE;
-- =============================================================================
