-- Alteração da tabela organization_settings para incluir novos parâmetros de comissão
ALTER TABLE organization_settings 
ADD COLUMN IF NOT EXISTS comissao_modelo_calculo TEXT DEFAULT 'regra_venda' CHECK (comissao_modelo_calculo IN ('regra_venda', 'faixas_meta')),
ADD COLUMN IF NOT EXISTS comissao_faixa_referencia TEXT DEFAULT 'vendedor' CHECK (comissao_faixa_referencia IN ('vendedor', 'loja', 'ambos')),
ADD COLUMN IF NOT EXISTS comissao_meta_minima_loja_percentual NUMERIC DEFAULT 0;
