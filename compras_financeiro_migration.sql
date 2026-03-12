-- ==========================================================
-- MIGRATION: Módulo Financeiro de Compras
-- Tabela de Contas a Pagar + campo forma_pagamento
-- ==========================================================

-- 1. Tabela de Contas a Pagar (Compromissos Financeiros)
CREATE TABLE IF NOT EXISTS compras_contas_pagar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE SET NULL,
  fornecedor_id BIGINT REFERENCES fornecedores(id),
  fornecedor_nome VARCHAR,
  tipo VARCHAR DEFAULT 'boleto',        -- 'boleto', 'pix', 'transferencia', 'avista'
  numero_parcela INT DEFAULT 1,
  total_parcelas INT DEFAULT 1,
  valor NUMERIC(15,2) NOT NULL,
  data_emissao DATE DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR DEFAULT 'pendente',     -- 'pendente', 'pago', 'vencido', 'cancelado'
  numero_documento VARCHAR,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (conforme template)
ALTER TABLE compras_contas_pagar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_contas_pagar ON compras_contas_pagar;
CREATE POLICY all_compras_contas_pagar ON compras_contas_pagar 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Adicionar campo forma_pagamento na tabela compras_ordens
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='forma_pagamento') THEN
        ALTER TABLE compras_ordens ADD COLUMN forma_pagamento VARCHAR DEFAULT 'boleto';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compras_ordens' AND column_name='qtd_parcelas') THEN
        ALTER TABLE compras_ordens ADD COLUMN qtd_parcelas INT DEFAULT 1;
    END IF;
END $$;







