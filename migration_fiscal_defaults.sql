-- ============================================================================
-- MIGRATION: Fiscal Defaults for NF-e Tax Compliance
-- Purpose: Add configurable fiscal defaults to organization_nfe_configs
--          and product-level fiscal overrides to produtos table.
-- Required for: Production NF-e emission (Lei 12.741/2012, SEFAZ compliance)
-- ============================================================================

-- ─── 1. Organization-Level Fiscal Defaults ───────────────────────────────────
-- These allow the contador to set defaults per organization,
-- avoiding hardcoded values in the edge function.

ALTER TABLE organization_nfe_configs
    ADD COLUMN IF NOT EXISTS csosn_padrao            TEXT DEFAULT '102',
    ADD COLUMN IF NOT EXISTS cst_icms_padrao          TEXT DEFAULT '00',
    ADD COLUMN IF NOT EXISTS cst_pis_padrao            TEXT DEFAULT '49',
    ADD COLUMN IF NOT EXISTS cst_cofins_padrao         TEXT DEFAULT '49',
    ADD COLUMN IF NOT EXISTS aliquota_icms_padrao      NUMERIC(5,2) DEFAULT 17.00,
    ADD COLUMN IF NOT EXISTS aliquota_icms_interestadual_padrao NUMERIC(5,2) DEFAULT 12.00,
    ADD COLUMN IF NOT EXISTS aliquota_pis_padrao       NUMERIC(5,2) DEFAULT 0.65,
    ADD COLUMN IF NOT EXISTS aliquota_cofins_padrao    NUMERIC(5,2) DEFAULT 3.00,
    ADD COLUMN IF NOT EXISTS percentual_tributos_padrao NUMERIC(5,2) DEFAULT 17.00,
    ADD COLUMN IF NOT EXISTS mod_frete_padrao          INTEGER DEFAULT 9;

-- Add complemento column if missing (referenced in ConfiguracaoNfe)
ALTER TABLE organization_nfe_configs
    ADD COLUMN IF NOT EXISTS emitente_complemento TEXT;

COMMENT ON COLUMN organization_nfe_configs.csosn_padrao IS 'CSOSN padrão para Simples Nacional (102=Sem crédito, 103=Isenta, 300=Imune, 400=Não tributada, 500=ICMS-ST, 900=Outros)';
COMMENT ON COLUMN organization_nfe_configs.cst_icms_padrao IS 'CST ICMS padrão para Regime Normal (00=Tributada integralmente, 10=Com ST, 20=Com redução BC, 40=Isenta, 41=Não tributada, 60=ICMS-ST cobrado ant., 90=Outras)';
COMMENT ON COLUMN organization_nfe_configs.cst_pis_padrao IS 'CST PIS padrão (01=Tributável aliquota, 04=Monofásico, 06=Aliquota zero, 07=Isenta, 08=Sem incidência, 09=Com suspensão, 49=Outras saídas, 99=Outras)';
COMMENT ON COLUMN organization_nfe_configs.cst_cofins_padrao IS 'CST COFINS padrão (mesmos códigos do PIS)';
COMMENT ON COLUMN organization_nfe_configs.percentual_tributos_padrao IS 'Percentual estimado de tributos para vTotTrib (Lei da Transparência 12.741/2012). Ex: 17% para móveis NCM 94xx';
COMMENT ON COLUMN organization_nfe_configs.mod_frete_padrao IS 'Modalidade de frete padrão: 0=CIF(emitente), 1=FOB(destinatário), 2=Terceiros, 3=Próprio remetente, 4=Próprio destinatário, 9=Sem frete';

-- ─── 2. Product-Level Fiscal Overrides ───────────────────────────────────────
-- When set, these override the org defaults for specific products.
-- If NULL, the edge function falls back to org defaults then system defaults.

ALTER TABLE produtos
    ADD COLUMN IF NOT EXISTS csosn              TEXT,
    ADD COLUMN IF NOT EXISTS cst_icms           TEXT,
    ADD COLUMN IF NOT EXISTS cst_pis            TEXT,
    ADD COLUMN IF NOT EXISTS cst_cofins         TEXT,
    ADD COLUMN IF NOT EXISTS aliquota_icms      NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS percentual_tributos NUMERIC(5,2);

COMMENT ON COLUMN produtos.csosn IS 'Override CSOSN para Simples Nacional. NULL = usa padrão da organização';
COMMENT ON COLUMN produtos.cst_icms IS 'Override CST ICMS para Regime Normal. NULL = usa padrão da organização';
COMMENT ON COLUMN produtos.cst_pis IS 'Override CST PIS. NULL = usa padrão da organização';
COMMENT ON COLUMN produtos.cst_cofins IS 'Override CST COFINS. NULL = usa padrão da organização';
COMMENT ON COLUMN produtos.aliquota_icms IS 'Override alíquota ICMS (%). NULL = usa padrão da organização';
COMMENT ON COLUMN produtos.percentual_tributos IS 'Override percentual tributos aproximado para Lei da Transparência (%). NULL = usa padrão da organização';
