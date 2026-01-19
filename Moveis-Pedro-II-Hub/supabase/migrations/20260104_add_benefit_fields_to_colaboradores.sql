-- Migration: add_benefit_fields_to_colaboradores
-- Execute this migration in your Supabase SQL Editor to add benefit tracking fields

-- Adicionar campos de benefícios à tabela colaboradores
ALTER TABLE colaboradores
ADD COLUMN IF NOT EXISTS vale_transporte DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vale_alimentacao DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vale_refeicao DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS plano_saude DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS plano_odontologico DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_mensal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS outros_beneficios DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descricao_outros_beneficios TEXT,
ADD COLUMN IF NOT EXISTS dia_pagamento INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT DEFAULT 'Mensal';

-- Adicionar comentários para documentação
COMMENT ON COLUMN colaboradores.vale_transporte IS 'Valor do vale transporte mensal';
COMMENT ON COLUMN colaboradores.vale_alimentacao IS 'Valor do vale alimentação mensal';
COMMENT ON COLUMN colaboradores.vale_refeicao IS 'Valor do vale refeição mensal';
COMMENT ON COLUMN colaboradores.plano_saude IS 'Valor do plano de saúde mensal';
COMMENT ON COLUMN colaboradores.plano_odontologico IS 'Valor do plano odontológico mensal';
COMMENT ON COLUMN colaboradores.bonus_mensal IS 'Valor de bônus fixo mensal';
COMMENT ON COLUMN colaboradores.outros_beneficios IS 'Valor de outros benefícios mensais';
COMMENT ON COLUMN colaboradores.descricao_outros_beneficios IS 'Descrição dos outros benefícios';
COMMENT ON COLUMN colaboradores.dia_pagamento IS 'Dia do mês para pagamento (1-31)';
COMMENT ON COLUMN colaboradores.tipo_pagamento IS 'Tipo de pagamento: Mensal, Quinzenal, Semanal';
