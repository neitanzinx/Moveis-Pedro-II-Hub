-- =============================================================================
-- MIGRATION: Regras Trabalhistas Brasileiras (CLT)
-- Adiciona campos para toggles CLT nos colaboradores
-- e campos de cálculo nas folhas de pagamento
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NOVOS CAMPOS EM colaboradores (toggles por funcionário)
-- -----------------------------------------------------------------------------
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS adicional_noturno BOOLEAN DEFAULT false;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS insalubridade_grau TEXT DEFAULT NULL;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS periculosidade BOOLEAN DEFAULT false;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS numero_dependentes INTEGER DEFAULT 0;

COMMENT ON COLUMN colaboradores.adicional_noturno IS 'Se o colaborador recebe adicional noturno (20% CLT)';
COMMENT ON COLUMN colaboradores.insalubridade_grau IS 'Grau de insalubridade: null, minimo (10%), medio (20%), maximo (40%) - sobre salário mínimo';
COMMENT ON COLUMN colaboradores.periculosidade IS 'Se o colaborador recebe adicional de periculosidade (30% sobre salário base)';
COMMENT ON COLUMN colaboradores.numero_dependentes IS 'Número de dependentes para cálculo IRRF e Salário Família';

-- -----------------------------------------------------------------------------
-- 2. NOVOS CAMPOS EM folhas_pagamento (valores calculados)
-- -----------------------------------------------------------------------------
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS adicional_noturno NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS insalubridade NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS periculosidade NUMERIC(10,2) DEFAULT 0;
ALTER TABLE folhas_pagamento ADD COLUMN IF NOT EXISTS salario_familia NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN folhas_pagamento.adicional_noturno IS 'Valor do adicional noturno calculado';
COMMENT ON COLUMN folhas_pagamento.insalubridade IS 'Valor do adicional de insalubridade calculado';
COMMENT ON COLUMN folhas_pagamento.periculosidade IS 'Valor do adicional de periculosidade calculado';
COMMENT ON COLUMN folhas_pagamento.salario_familia IS 'Valor do salário família calculado';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
