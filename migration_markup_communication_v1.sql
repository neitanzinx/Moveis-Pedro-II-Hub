-- SAFE MIGRATION
ALTER TABLE compras_ordens 
ADD COLUMN IF NOT EXISTS quem_aceitou VARCHAR,
ADD COLUMN IF NOT EXISTS data_hora_comunicacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tipo_comunicacao VARCHAR,
ADD COLUMN IF NOT EXISTS devolutiva TEXT;

ALTER TABLE compras_markup_configs
ADD COLUMN IF NOT EXISTS multiplicador_final NUMERIC(10,4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS bonus_valor JSONB DEFAULT '{"minimo": 0, "desconto_extra": 0}'::jsonb;

CREATE TABLE IF NOT EXISTS compras_comunicacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id UUID REFERENCES compras_ordens(id) ON DELETE CASCADE,
  campo VARCHAR NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compras_comunicacoes_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_compras_comunicacoes_historico ON compras_comunicacoes_historico;
CREATE POLICY all_compras_comunicacoes_historico ON compras_comunicacoes_historico 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
