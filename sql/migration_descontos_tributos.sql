-- Migration para adicionar campos de descontos e tributação manual na tabela colaboradores
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS desconto_vale_transporte numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS desconto_plano_saude numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS desconto_adiantamento numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS outros_descontos numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS descricao_outros_descontos text;

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_inss text DEFAULT 'automatico';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS valor_inss numeric(10,2);

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_irrf text DEFAULT 'automatico';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS valor_irrf numeric(10,2);

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_fgts text DEFAULT 'automatico';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS valor_fgts numeric(10,2);

-- Garantir que outros campos de benefícios existam
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS vale_transporte numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS vale_alimentacao numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS vale_refeicao numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS plano_saude numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS plano_odontologico numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS bonus_mensal numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS outros_beneficios numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS descricao_outros_beneficios text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS pensao_alimenticia numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS recebe_vale boolean;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS dia_vale integer;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS valor_dia_pagamento numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS valor_dia_vale numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS numero_dependentes integer;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS dia_pagamento integer;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_pagamento text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS adicional_noturno boolean;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS insalubridade_grau text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS periculosidade boolean;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS pin_montagem text;

-- Tipos de dia para pagamento (fixo ou útil)
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_dia_pagamento text DEFAULT 'util';
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_dia_vale text DEFAULT 'fixo';
