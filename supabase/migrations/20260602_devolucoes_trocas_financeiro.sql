-- Expande estrutura de devolucoes para suportar devolucao parcial,
-- destino de estoque e tratamento financeiro (estorno imediato ou credito cliente).
-- Tambem adiciona vinculos de origem em lancamentos_financeiros para rastreabilidade.

ALTER TABLE devolucoes
  ADD COLUMN IF NOT EXISTS numero_pedido text,
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS data_devolucao date,
  ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'Devolução',
  ADD COLUMN IF NOT EXISTS itens_devolvidos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS itens_troca jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_devolvido numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_diferenca numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS aprovado_por text,
  ADD COLUMN IF NOT EXISTS data_aprovacao timestamptz,
  ADD COLUMN IF NOT EXISTS processado_por text,
  ADD COLUMN IF NOT EXISTS data_processamento timestamptz,
  ADD COLUMN IF NOT EXISTS justificativa_financeira text,
  ADD COLUMN IF NOT EXISTS financeiro_tipo text DEFAULT 'estorno_imediato',
  ADD COLUMN IF NOT EXISTS destino_estoque text,
  ADD COLUMN IF NOT EXISTS financeiro_lancamento_id uuid,
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE devolucoes
  ALTER COLUMN status SET DEFAULT 'Pendente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devolucoes_tipo_check'
      AND conrelid = 'devolucoes'::regclass
  ) THEN
    ALTER TABLE devolucoes
      ADD CONSTRAINT devolucoes_tipo_check
      CHECK (tipo IN ('Devolução', 'Troca'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devolucoes_financeiro_tipo_check'
      AND conrelid = 'devolucoes'::regclass
  ) THEN
    ALTER TABLE devolucoes
      ADD CONSTRAINT devolucoes_financeiro_tipo_check
      CHECK (financeiro_tipo IN ('estorno_imediato', 'credito_cliente'));
  END IF;
END $$;

ALTER TABLE lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS venda_id uuid,
  ADD COLUMN IF NOT EXISTS devolucao_id uuid,
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS origem_ref text,
  ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT '00000000-0000-0000-0000-000000000001';

CREATE INDEX IF NOT EXISTS idx_devolucoes_venda_id ON devolucoes(venda_id);
CREATE INDEX IF NOT EXISTS idx_devolucoes_status ON devolucoes(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_venda_id ON lancamentos_financeiros(venda_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_devolucao_id ON lancamentos_financeiros(devolucao_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_financeiros_origem ON lancamentos_financeiros(origem_tipo, origem_id);
