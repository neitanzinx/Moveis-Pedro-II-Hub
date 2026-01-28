-- Criar tabela configuracao_taxa com campos de taxa e acréscimo
-- Taxa = custo interno (descontado no financeiro)
-- Acréscimo = valor repassado ao cliente no PDV

CREATE TABLE IF NOT EXISTS configuracao_taxa (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    forma_pagamento text NOT NULL UNIQUE,
    descricao text,
    tipo_taxa text DEFAULT 'porcentagem' CHECK (tipo_taxa IN ('porcentagem', 'fixo')),
    valor numeric(10,2) DEFAULT 0,
    ativa boolean DEFAULT true,
    acrescimo numeric(10,2) DEFAULT 0,
    acrescimo_tipo text DEFAULT 'porcentagem' CHECK (acrescimo_tipo IN ('porcentagem', 'fixo')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Criar índice para busca por forma de pagamento
CREATE INDEX IF NOT EXISTS idx_configuracao_taxa_forma ON configuracao_taxa(forma_pagamento);

-- Inserir configurações padrão para formas de pagamento comuns
INSERT INTO configuracao_taxa (forma_pagamento, descricao, tipo_taxa, valor, ativa, acrescimo, acrescimo_tipo) VALUES
  ('Dinheiro', 'Pagamento em espécie', 'porcentagem', 0, true, 0, 'porcentagem'),
  ('Pix', 'Pagamento instantâneo via Pix', 'porcentagem', 0, true, 0, 'porcentagem'),
  ('Débito', 'Cartão de débito', 'porcentagem', 1.5, true, 0, 'porcentagem'),
  ('Crédito 1x', 'Cartão de crédito à vista', 'porcentagem', 2.5, true, 0, 'porcentagem'),
  ('Crédito Parcelado', 'Cartão de crédito parcelado', 'porcentagem', 4.5, true, 3, 'porcentagem'),
  ('Multicrédito', 'Múltiplos cartões', 'porcentagem', 5, true, 5, 'porcentagem'),
  ('AFESP', 'Convênio AFESP', 'porcentagem', 2, true, 2, 'porcentagem'),
  ('Boleto', 'Boleto bancário', 'fixo', 3.50, true, 0, 'porcentagem'),
  ('Crediário', 'Crediário próprio', 'porcentagem', 0, true, 0, 'porcentagem'),
  ('Financiamento', 'Financiamento bancário', 'porcentagem', 0, true, 0, 'porcentagem'),
  ('Transferência', 'Transferência bancária', 'porcentagem', 0, true, 0, 'porcentagem'),
  ('Link de Pagamento', 'Link de pagamento online', 'porcentagem', 3, true, 0, 'porcentagem')
ON CONFLICT (forma_pagamento) DO NOTHING;

-- Habilitar RLS
ALTER TABLE configuracao_taxa ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos os usuários autenticados
CREATE POLICY "Leitura configuracao_taxa" ON configuracao_taxa
    FOR SELECT
    USING (true);

-- Política de modificação apenas para administradores
CREATE POLICY "Modificacao configuracao_taxa" ON configuracao_taxa
    FOR ALL
    USING (true);

-- Comentários
COMMENT ON TABLE configuracao_taxa IS 'Configurações de taxas e acréscimos por forma de pagamento';
COMMENT ON COLUMN configuracao_taxa.valor IS 'Valor da taxa interna (custo para a loja)';
COMMENT ON COLUMN configuracao_taxa.acrescimo IS 'Valor do acréscimo repassado ao cliente no PDV';
