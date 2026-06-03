ALTER TABLE devolucoes
  ADD COLUMN IF NOT EXISTS pagamento_diferenca_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS forma_pagamento_diferenca text,
  ADD COLUMN IF NOT EXISTS pagamento_diferenca_parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pagamento_diferenca_valor numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagamento_diferenca_observacao text,
  ADD COLUMN IF NOT EXISTS destino_troco text;

-- Crédito de loja retido no cadastro do cliente
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS saldo_credito numeric(12,2) DEFAULT 0;
