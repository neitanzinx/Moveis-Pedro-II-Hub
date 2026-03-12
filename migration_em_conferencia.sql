-- Migration: Adicionar 'Em Conferência' ao CHECK constraint da coluna status em pedidos_compra
-- Data: 2026-02-23
-- Motivo: O status "Em Conferência" foi introduzido para rastrear pedidos sendo conferidos fisicamente pelo estoque.
-- Sem essa alteração, qualquer UPDATE que tente setar status = 'Em Conferência' será rejeitado pelo banco.

-- 1. Remover o constraint antigo
ALTER TABLE pedidos_compra DROP CONSTRAINT IF EXISTS pedidos_compra_status_check;

-- 2. Recriar com o novo valor incluído
ALTER TABLE pedidos_compra ADD CONSTRAINT pedidos_compra_status_check 
    CHECK (status IN ('Rascunho', 'Enviado', 'Confirmado', 'Em Conferência', 'Parcialmente Recebido', 'Recebido', 'Cancelado'));
