-- Add missing delivery payment columns on vendas
-- Idempotent migration to align runtime code with database schema

ALTER TABLE vendas
ADD COLUMN IF NOT EXISTS pagamento_entrega_confirmado boolean DEFAULT false;

ALTER TABLE vendas
ADD COLUMN IF NOT EXISTS pagamento_entrega_observacao text;
