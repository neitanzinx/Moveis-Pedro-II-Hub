-- Migration: NFe Integration Tables
-- Creates tables for full NFe import with all tax details
-- VERSAO SEM FOREIGN KEYS (compativel com IDs bigint existentes)

-- Table: notas_fiscais_entrada (Header da NF-e)
CREATE TABLE IF NOT EXISTS notas_fiscais_entrada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave_acesso text UNIQUE NOT NULL,
    numero_nota text,
    serie text,
    data_emissao timestamptz,
    data_entrada timestamptz DEFAULT now(),
    
    -- Emitente (Fornecedor) - sem FK, apenas ID como texto
    fornecedor_id text,
    fornecedor_cnpj text,
    fornecedor_razao_social text,
    fornecedor_nome_fantasia text,
    fornecedor_ie text,
    fornecedor_endereco text,
    fornecedor_cidade text,
    fornecedor_uf text,
    
    -- Destinatario (Nossa Empresa)
    destinatario_cnpj text,
    destinatario_razao_social text,
    
    -- Totais Produtos
    valor_produtos numeric(12,2),
    valor_frete numeric(12,2),
    valor_seguro numeric(12,2),
    valor_desconto numeric(12,2),
    valor_outras_despesas numeric(12,2),
    valor_total_nota numeric(12,2),
    
    -- Impostos Totais
    base_icms numeric(12,2),
    valor_icms numeric(12,2),
    base_icms_st numeric(12,2),
    valor_icms_st numeric(12,2),
    valor_fcp numeric(12,2),
    valor_fcp_st numeric(12,2),
    valor_ipi numeric(12,2),
    valor_ii numeric(12,2),
    valor_pis numeric(12,2),
    valor_cofins numeric(12,2),
    valor_issqn numeric(12,2),
    valor_aproximado_tributos numeric(12,2),
    
    -- Transporte
    modalidade_frete text,
    transportadora_cnpj text,
    transportadora_nome text,
    transportadora_ie text,
    placa_veiculo text,
    uf_veiculo text,
    quantidade_volumes integer,
    especie_volumes text,
    peso_liquido numeric(12,3),
    peso_bruto numeric(12,3),
    
    -- Pagamento
    forma_pagamento text,
    valor_pagamento numeric(12,2),
    
    -- Informacoes Complementares
    informacoes_complementares text,
    informacoes_fisco text,
    
    -- Status e Controle
    status text DEFAULT 'Importada',
    lancamento_financeiro_id text,
    importado_por text,
    importado_por_nome text,
    empresa_destino text,
    xml_original text,
    observacoes text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table: itens_nota_fiscal (Detalhes de cada item)
CREATE TABLE IF NOT EXISTS itens_nota_fiscal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_fiscal_id uuid REFERENCES notas_fiscais_entrada(id) ON DELETE CASCADE,
    produto_id text,
    numero_item integer,
    
    -- Identificacao do Produto
    codigo_produto_fornecedor text,
    codigo_barras_ean text,
    codigo_barras_tributavel text,
    descricao_produto text,
    ncm text,
    nve text,
    cest text,
    cfop text,
    unidade_comercial text,
    unidade_tributavel text,
    
    -- Quantidades e Valores
    quantidade numeric(12,4),
    quantidade_tributavel numeric(12,4),
    valor_unitario numeric(15,10),
    valor_unitario_tributavel numeric(15,10),
    valor_total_produto numeric(12,2),
    valor_frete_rateado numeric(12,2),
    valor_seguro_rateado numeric(12,2),
    valor_desconto numeric(12,2),
    valor_outras_despesas numeric(12,2),
    
    -- ICMS
    origem_mercadoria text,
    cst_icms text,
    modalidade_bc_icms text,
    base_calculo_icms numeric(12,2),
    percentual_reducao_bc numeric(5,2),
    aliquota_icms numeric(5,2),
    valor_icms numeric(12,2),
    
    -- ICMS ST
    modalidade_bc_icms_st text,
    percentual_mva_st numeric(5,2),
    percentual_reducao_bc_st numeric(5,2),
    base_calculo_icms_st numeric(12,2),
    aliquota_icms_st numeric(5,2),
    valor_icms_st numeric(12,2),
    
    -- FCP (Fundo de Combate a Pobreza)
    base_calculo_fcp numeric(12,2),
    percentual_fcp numeric(5,2),
    valor_fcp numeric(12,2),
    
    -- IPI
    cst_ipi text,
    codigo_enquadramento_ipi text,
    base_calculo_ipi numeric(12,2),
    aliquota_ipi numeric(5,2),
    valor_ipi numeric(12,2),
    
    -- PIS
    cst_pis text,
    base_calculo_pis numeric(12,2),
    aliquota_pis numeric(5,2),
    valor_pis numeric(12,2),
    
    -- COFINS
    cst_cofins text,
    base_calculo_cofins numeric(12,2),
    aliquota_cofins numeric(5,2),
    valor_cofins numeric(12,2),
    
    -- II (Imposto de Importacao)
    base_calculo_ii numeric(12,2),
    despesas_aduaneiras numeric(12,2),
    valor_ii numeric(12,2),
    valor_iof numeric(12,2),
    
    -- Valor Aproximado de Tributos (Lei de Transparencia)
    valor_aproximado_tributos numeric(12,2),
    
    -- Informacoes Adicionais do Item
    informacoes_adicionais text,
    numero_pedido_compra text,
    item_pedido_compra text,
    
    -- Vinculacao com Produto do Sistema
    produto_vinculado boolean DEFAULT false,
    produto_criado boolean DEFAULT false,
    requer_atencao boolean DEFAULT false,
    motivo_atencao text,
    
    created_at timestamptz DEFAULT now()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_chave_acesso ON notas_fiscais_entrada(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_numero_nota ON notas_fiscais_entrada(numero_nota);
CREATE INDEX IF NOT EXISTS idx_nfe_fornecedor_id ON notas_fiscais_entrada(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_nfe_fornecedor_cnpj ON notas_fiscais_entrada(fornecedor_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfe_data_entrada ON notas_fiscais_entrada(data_entrada);
CREATE INDEX IF NOT EXISTS idx_nfe_status ON notas_fiscais_entrada(status);
CREATE INDEX IF NOT EXISTS idx_nfe_lancamento_financeiro ON notas_fiscais_entrada(lancamento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_nfe_empresa_destino ON notas_fiscais_entrada(empresa_destino);

CREATE INDEX IF NOT EXISTS idx_itens_nfe_nota_fiscal ON itens_nota_fiscal(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_produto ON itens_nota_fiscal(produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_ean ON itens_nota_fiscal(codigo_barras_ean);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_ncm ON itens_nota_fiscal(ncm);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_requer_atencao ON itens_nota_fiscal(requer_atencao);

-- RLS Policies
ALTER TABLE notas_fiscais_entrada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_policy ON notas_fiscais_entrada;
CREATE POLICY nfe_policy ON notas_fiscais_entrada FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE itens_nota_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itens_nfe_policy ON itens_nota_fiscal;
CREATE POLICY itens_nfe_policy ON itens_nota_fiscal FOR ALL USING (auth.role() = 'authenticated');

-- Adicionar campos em produtos para rastreabilidade NFe
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS origem_nfe boolean DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS requer_atencao boolean DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS motivo_atencao text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ultima_nfe_id text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm text;
