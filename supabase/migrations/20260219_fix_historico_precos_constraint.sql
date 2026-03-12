-- Migration to fix the 'historico_precos_tipo_check' constraint
-- This migration drops the existing constraint and recreates it with a comprehensive list of allowed values
-- to support 'venda' (used in imports and manual updates), 'custo', 'promocao', etc.

ALTER TABLE IF EXISTS public.historico_precos DROP CONSTRAINT IF EXISTS historico_precos_tipo_check;

ALTER TABLE IF EXISTS public.historico_precos 
ADD CONSTRAINT historico_precos_tipo_check 
CHECK (tipo IN ('venda', 'custo', 'promocao', 'alteracao', 'reajuste', 'inicial'));
