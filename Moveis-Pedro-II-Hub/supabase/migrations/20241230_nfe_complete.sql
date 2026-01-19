-- ============================================================
-- Migration: Sistema Completo de NFe
-- Criado em: 2024-12-30
-- Descrição: Tabelas para emissão e recebimento de NFe
-- ============================================================

-- ============================================================
-- PARTE 1: TABELAS PARA ENTRADA DE NFE (Compras/Fornecedores)
-- ============================================================

-- Tabela principal de notas fiscais de entrada
CREATE TABLE IF NOT EXISTS notas_fiscais_entrada (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave_acesso text UNIQUE NOT NULL,
    numero_nota text,
    serie text,
    data_emissao timestamptz,
    data_entrada timestamptz DEFAULT now(),
    
    -- Emitente (Fornecedor)
    fornecedor_id text,
    fornecedor_cnpj text,
    fornecedor_razao_social text,
    fornecedor_nome_fantasia text,
    fornecedor_ie text,
    fornecedor_endereco text,
    fornecedor_cidade text,
    fornecedor_uf text,
    
    -- Destinatário (Nossa Empresa)
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
    
    -- Informações Complementares
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

-- Tabela de itens da nota fiscal de entrada
CREATE TABLE IF NOT EXISTS itens_nota_fiscal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_fiscal_id uuid REFERENCES notas_fiscais_entrada(id) ON DELETE CASCADE,
    produto_id text,
    numero_item integer,
    
    -- Identificação do Produto
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
    
    -- FCP
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
    
    -- II (Imposto de Importação)
    base_calculo_ii numeric(12,2),
    despesas_aduaneiras numeric(12,2),
    valor_ii numeric(12,2),
    valor_iof numeric(12,2),
    
    -- Valor Aproximado de Tributos
    valor_aproximado_tributos numeric(12,2),
    
    -- Informações Adicionais
    informacoes_adicionais text,
    numero_pedido_compra text,
    item_pedido_compra text,
    
    -- Vinculação com Produto do Sistema
    produto_vinculado boolean DEFAULT false,
    produto_criado boolean DEFAULT false,
    requer_atencao boolean DEFAULT false,
    motivo_atencao text,
    
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PARTE 2: TABELAS PARA EMISSÃO DE NFE (Vendas)
-- ============================================================

-- Tabela de notas fiscais emitidas
CREATE TABLE IF NOT EXISTS notas_fiscais_emitidas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id text,
    
    -- Identificação da Nota
    chave_acesso text UNIQUE,
    numero_nota text,
    serie text,
    modelo text DEFAULT '55',
    natureza_operacao text DEFAULT 'Venda de Mercadoria',
    
    -- Datas
    data_emissao timestamptz,
    data_saida timestamptz,
    data_autorizacao timestamptz,
    
    -- Emitente
    emitente_cnpj text,
    emitente_razao_social text,
    emitente_ie text,
    
    -- Destinatário
    destinatario_cpf_cnpj text,
    destinatario_nome text,
    destinatario_endereco text,
    destinatario_numero text,
    destinatario_bairro text,
    destinatario_cidade text,
    destinatario_uf text,
    destinatario_cep text,
    destinatario_telefone text,
    destinatario_email text,
    
    -- Valores Totais
    valor_produtos numeric(12,2),
    valor_frete numeric(12,2),
    valor_seguro numeric(12,2),
    valor_desconto numeric(12,2),
    valor_outras_despesas numeric(12,2),
    valor_total numeric(12,2),
    
    -- Impostos
    base_icms numeric(12,2),
    valor_icms numeric(12,2),
    valor_icms_st numeric(12,2),
    valor_ipi numeric(12,2),
    valor_pis numeric(12,2),
    valor_cofins numeric(12,2),
    valor_aproximado_tributos numeric(12,2),
    
    -- Status da Nota
    status text DEFAULT 'Pendente',
    codigo_status integer,
    motivo_status text,
    protocolo_autorizacao text,
    
    -- Arquivos
    xml_nfe text,
    xml_procnfe text,
    pdf_danfe_url text,
    
    -- Nuvem Fiscal IDs
    nuvem_fiscal_id text,
    
    -- Controle
    ambiente text,
    emitido_por text,
    emitido_por_nome text,
    empresa_emissora text,
    empresa_cnpj text,
    
    -- Observações
    informacoes_complementares text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Tabela de itens das NFes emitidas
CREATE TABLE IF NOT EXISTS itens_nfe_emitida (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_fiscal_id uuid REFERENCES notas_fiscais_emitidas(id) ON DELETE CASCADE,
    produto_id text,
    numero_item integer,
    
    -- Produto
    codigo_produto text,
    descricao text,
    ncm text,
    cfop text,
    unidade text,
    
    -- Valores
    quantidade numeric(12,4),
    valor_unitario numeric(15,10),
    valor_total numeric(12,2),
    valor_desconto numeric(12,2),
    
    -- ICMS
    origem text DEFAULT '0',
    cst_icms text,
    base_icms numeric(12,2),
    aliquota_icms numeric(5,2),
    valor_icms numeric(12,2),
    
    -- Simples Nacional (CSOSN)
    csosn text,
    
    -- PIS
    cst_pis text DEFAULT '49',
    base_pis numeric(12,2),
    aliquota_pis numeric(5,2),
    valor_pis numeric(12,2),
    
    -- COFINS
    cst_cofins text DEFAULT '49',
    base_cofins numeric(12,2),
    aliquota_cofins numeric(5,2),
    valor_cofins numeric(12,2),
    
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PARTE 3: ÍNDICES PARA PERFORMANCE
-- ============================================================

-- Índices para notas_fiscais_entrada
CREATE INDEX IF NOT EXISTS idx_nfe_chave_acesso ON notas_fiscais_entrada(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_numero_nota ON notas_fiscais_entrada(numero_nota);
CREATE INDEX IF NOT EXISTS idx_nfe_fornecedor_id ON notas_fiscais_entrada(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_nfe_fornecedor_cnpj ON notas_fiscais_entrada(fornecedor_cnpj);
CREATE INDEX IF NOT EXISTS idx_nfe_data_entrada ON notas_fiscais_entrada(data_entrada);
CREATE INDEX IF NOT EXISTS idx_nfe_status ON notas_fiscais_entrada(status);
CREATE INDEX IF NOT EXISTS idx_nfe_empresa_destino ON notas_fiscais_entrada(empresa_destino);

-- Índices para itens_nota_fiscal
CREATE INDEX IF NOT EXISTS idx_itens_nfe_nota_fiscal ON itens_nota_fiscal(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_produto ON itens_nota_fiscal(produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_ean ON itens_nota_fiscal(codigo_barras_ean);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_ncm ON itens_nota_fiscal(ncm);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_requer_atencao ON itens_nota_fiscal(requer_atencao);

-- Índices para notas_fiscais_emitidas
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_venda ON notas_fiscais_emitidas(venda_id);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_chave ON notas_fiscais_emitidas(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_numero ON notas_fiscais_emitidas(numero_nota);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_status ON notas_fiscais_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_data ON notas_fiscais_emitidas(data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_empresa ON notas_fiscais_emitidas(empresa_cnpj);

-- Índices para itens_nfe_emitida
CREATE INDEX IF NOT EXISTS idx_itens_nfe_emitida_nota ON itens_nfe_emitida(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_emitida_produto ON itens_nfe_emitida(produto_id);

-- ============================================================
-- PARTE 4: COLUNAS ADICIONAIS EM TABELAS EXISTENTES
-- ============================================================

-- Colunas em produtos para rastreabilidade NFe
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS origem_nfe boolean DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS requer_atencao boolean DEFAULT false;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS motivo_atencao text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ultima_nfe_id text;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm text;

-- Colunas em vendas para indicar NFe emitida
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_emitida boolean DEFAULT false;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_chave text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_numero text;

-- ============================================================
-- PARTE 5: RLS (Row Level Security)
-- ============================================================

-- RLS para notas_fiscais_entrada
ALTER TABLE notas_fiscais_entrada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_entrada_select ON notas_fiscais_entrada;
DROP POLICY IF EXISTS nfe_entrada_insert ON notas_fiscais_entrada;
DROP POLICY IF EXISTS nfe_entrada_update ON notas_fiscais_entrada;
DROP POLICY IF EXISTS nfe_entrada_delete ON notas_fiscais_entrada;

CREATE POLICY nfe_entrada_select ON notas_fiscais_entrada FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY nfe_entrada_insert ON notas_fiscais_entrada FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY nfe_entrada_update ON notas_fiscais_entrada FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY nfe_entrada_delete ON notas_fiscais_entrada FOR DELETE USING (auth.role() = 'authenticated');

-- RLS para itens_nota_fiscal
ALTER TABLE itens_nota_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itens_nfe_select ON itens_nota_fiscal;
DROP POLICY IF EXISTS itens_nfe_insert ON itens_nota_fiscal;
DROP POLICY IF EXISTS itens_nfe_update ON itens_nota_fiscal;
DROP POLICY IF EXISTS itens_nfe_delete ON itens_nota_fiscal;

CREATE POLICY itens_nfe_select ON itens_nota_fiscal FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_insert ON itens_nota_fiscal FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_update ON itens_nota_fiscal FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_delete ON itens_nota_fiscal FOR DELETE USING (auth.role() = 'authenticated');

-- RLS para notas_fiscais_emitidas
ALTER TABLE notas_fiscais_emitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_emitida_select ON notas_fiscais_emitidas;
DROP POLICY IF EXISTS nfe_emitida_insert ON notas_fiscais_emitidas;
DROP POLICY IF EXISTS nfe_emitida_update ON notas_fiscais_emitidas;
DROP POLICY IF EXISTS nfe_emitida_delete ON notas_fiscais_emitidas;

CREATE POLICY nfe_emitida_select ON notas_fiscais_emitidas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY nfe_emitida_insert ON notas_fiscais_emitidas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY nfe_emitida_update ON notas_fiscais_emitidas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY nfe_emitida_delete ON notas_fiscais_emitidas FOR DELETE USING (auth.role() = 'authenticated');

-- RLS para itens_nfe_emitida
ALTER TABLE itens_nfe_emitida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itens_nfe_emitida_select ON itens_nfe_emitida;
DROP POLICY IF EXISTS itens_nfe_emitida_insert ON itens_nfe_emitida;
DROP POLICY IF EXISTS itens_nfe_emitida_update ON itens_nfe_emitida;
DROP POLICY IF EXISTS itens_nfe_emitida_delete ON itens_nfe_emitida;

CREATE POLICY itens_nfe_emitida_select ON itens_nfe_emitida FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_emitida_insert ON itens_nfe_emitida FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_emitida_update ON itens_nfe_emitida FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY itens_nfe_emitida_delete ON itens_nfe_emitida FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
