-- Add anexos_financeiro, prazo_pagamento and tenant_id columns to compras_ordens table
ALTER TABLE compras_ordens ADD COLUMN IF NOT EXISTS anexos_financeiro JSONB DEFAULT '[]'::jsonb;
ALTER TABLE compras_ordens ADD COLUMN IF NOT EXISTS prazo_pagamento INTEGER;
ALTER TABLE compras_ordens ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Add ordem_id column to solicitacoes_encomenda table to reference compras_ordens
ALTER TABLE solicitacoes_encomenda ADD COLUMN IF NOT EXISTS ordem_id UUID REFERENCES compras_ordens(id);
