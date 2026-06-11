-- =============================================================================
-- MIGRATION: Detalhamento de Descontos e Controle de Pagamento Individual
-- Adiciona campos para detalhar cada tipo de desconto individualmente,
-- uma coluna JSONB para armazenar múltiplos descontos adicionais
-- e colunas para controle individual de pagamento de Salário e Vale/Adiantamento.
-- =============================================================================

ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS desconto_plano_saude NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS desconto_adiantamento NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS pensao_alimenticia NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS descontos_adicionais JSONB DEFAULT '[]'::jsonb;

-- Controle de status individual para Salário e Vale (Adiantamento)
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS salario_pago BOOLEAN DEFAULT false;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS vale_pago BOOLEAN DEFAULT false;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS data_pagamento_salario DATE;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS data_pagamento_vale DATE;

COMMENT ON COLUMN folhas_pagamento.desconto_plano_saude IS 'Desconto de plano de saúde do colaborador na folha';
COMMENT ON COLUMN folhas_pagamento.desconto_adiantamento IS 'Desconto de adiantamento (vale) do colaborador na folha';
COMMENT ON COLUMN folhas_pagamento.pensao_alimenticia IS 'Desconto de pensão alimentícia calculado para a folha';
COMMENT ON COLUMN folhas_pagamento.descontos_adicionais IS 'Array de descontos manuais adicionais formatado como [{"descricao": string, "valor": number}]';
COMMENT ON COLUMN folhas_pagamento.salario_pago IS 'Indica se a parcela de salário (geralmente dia 5) já foi paga';
COMMENT ON COLUMN folhas_pagamento.vale_pago IS 'Indica se a parcela de vale/adiantamento (geralmente dia 20) já foi paga';
COMMENT ON COLUMN folhas_pagamento.data_pagamento_salario IS 'Data em que a parcela de salário foi paga';
COMMENT ON COLUMN folhas_pagamento.data_pagamento_vale IS 'Data em que a parcela de vale/adiantamento foi paga';
