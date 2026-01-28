-- Migration: NFe Emission Tables
-- Creates tables for NFe emission and tracking
-- VERSAO SEM FOREIGN KEYS (compativel com IDs bigint existentes)

-- Table: notas_fiscais_emitidas (NFes emitidas pelo sistema)
CREATE TABLE IF NOT EXISTS notas_fiscais_emitidas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id text,
    
    -- Identificacao da Nota
    chave_acesso text UNIQUE,
    numero_nota text,
    serie text,
    modelo text DEFAULT '55',
    natureza_operacao text DEFAULT 'Venda de Mercadoria',
    
    -- Datas
    data_emissao timestamptz,
    data_saida timestamptz,
    
    -- Emitente
    emitente_cnpj text,
    emitente_razao_social text,
    emitente_ie text,
    
    -- Destinatario
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
    data_autorizacao timestamptz,
    
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
    
    -- Observacoes
    informacoes_complementares text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table: itens_nfe_emitida (Itens das NFes emitidas)
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

-- Indices
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_venda ON notas_fiscais_emitidas(venda_id);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_chave ON notas_fiscais_emitidas(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_numero ON notas_fiscais_emitidas(numero_nota);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_status ON notas_fiscais_emitidas(status);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_data ON notas_fiscais_emitidas(data_emissao);
CREATE INDEX IF NOT EXISTS idx_nfe_emitida_empresa ON notas_fiscais_emitidas(empresa_cnpj);

CREATE INDEX IF NOT EXISTS idx_itens_nfe_emitida_nota ON itens_nfe_emitida(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_itens_nfe_emitida_produto ON itens_nfe_emitida(produto_id);

-- RLS Policies
ALTER TABLE notas_fiscais_emitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_emitida_policy ON notas_fiscais_emitidas;
CREATE POLICY nfe_emitida_policy ON notas_fiscais_emitidas FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE itens_nfe_emitida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itens_nfe_emitida_policy ON itens_nfe_emitida;
CREATE POLICY itens_nfe_emitida_policy ON itens_nfe_emitida FOR ALL USING (auth.role() = 'authenticated');

-- Adicionar campo na tabela vendas para indicar se tem NFe
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_emitida boolean DEFAULT false;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_chave text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS nfe_numero text;
