-- Script para criar a tabela historico_precos no Supabase
-- Por favor, execute este script no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS historico_precos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
    preco_antigo NUMERIC,
    preco_novo NUMERIC,
    tipo TEXT,
    motivo TEXT,
    usuario_nome TEXT
);

-- Substitua "nova_tabela" pelo nome da sua tabela (conforme regra do usuário)
ALTER TABLE historico_precos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_historico_precos ON historico_precos;
CREATE POLICY all_historico_precos ON historico_precos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
