-- Migration: adiciona orcamento_origem_id à tabela vendas
-- Usado para idempotência: impede que o mesmo orçamento gere duas vendas
-- mesmo em caso de falha parcial ou re-navegação ao PDV.

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS orcamento_origem_id text;

-- Índice para a verificação de duplicata ser rápida
CREATE INDEX IF NOT EXISTS idx_vendas_orcamento_origem_id
    ON vendas (orcamento_origem_id)
    WHERE orcamento_origem_id IS NOT NULL;
