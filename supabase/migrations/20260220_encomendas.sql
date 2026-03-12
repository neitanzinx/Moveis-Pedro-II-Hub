-- 1. Add encomenda toggle to fornecedores
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS encomendas_habilitadas BOOLEAN DEFAULT true;

-- 2. Create encomenda requests table (goes to purchasing department)
CREATE TABLE IF NOT EXISTS solicitacoes_encomenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id BIGINT REFERENCES vendas(id),
  produto_id UUID,
  produto_nome TEXT NOT NULL,
  fornecedor_nome TEXT,
  quantidade INTEGER DEFAULT 1,
  cliente_nome TEXT,
  numero_pedido TEXT,
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS per user rules
ALTER TABLE solicitacoes_encomenda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_solicitacoes_encomenda ON solicitacoes_encomenda;
CREATE POLICY all_solicitacoes_encomenda ON solicitacoes_encomenda 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
