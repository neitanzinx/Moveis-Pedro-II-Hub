-- ============================================
-- MIGRATION: Novas Funcionalidades v2.0
-- Data: 2026-01-03
-- ============================================

-- ============================================
-- FEATURE 1: Campos de Foto na Entrega
-- ============================================

-- Adicionar campos de foto e geolocalização na tabela entregas
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS foto_entrega_url TEXT;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS fotos_entrega JSONB DEFAULT '[]';
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS geolocalizacao_entrega JSONB;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS data_hora_entrega TIMESTAMPTZ;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS recebedor_nome TEXT;
ALTER TABLE entregas ADD COLUMN IF NOT EXISTS recebedor_documento TEXT;

-- Comentários para documentação
COMMENT ON COLUMN entregas.foto_entrega_url IS 'URL da foto principal da entrega (depreciado, usar fotos_entrega)';
COMMENT ON COLUMN entregas.fotos_entrega IS 'Array de URLs das fotos da entrega [{url, tipo, timestamp}]';
COMMENT ON COLUMN entregas.geolocalizacao_entrega IS 'Coordenadas GPS da entrega {latitude, longitude, accuracy}';
COMMENT ON COLUMN entregas.data_hora_entrega IS 'Data e hora exata da conclusão da entrega';
COMMENT ON COLUMN entregas.recebedor_nome IS 'Nome de quem recebeu a entrega';
COMMENT ON COLUMN entregas.recebedor_documento IS 'CPF/RG de quem recebeu';

-- ============================================
-- FEATURE 2: Cobranças PIX (Stone)
-- ============================================

-- Tabela para armazenar cobranças PIX
CREATE TABLE IF NOT EXISTS cobrancas_pix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Use BIGINT para compatibilidade com tabelas existentes que usam serial/bigserial
    venda_id BIGINT,
    entrega_id BIGINT,
    
    -- Identificadores Stone
    stone_txid TEXT UNIQUE,
    stone_location TEXT,
    stone_e2e_id TEXT,
    
    -- QR Code
    qr_code_content TEXT,
    qr_code_image TEXT,
    pix_copia_cola TEXT,
    
    -- Valores
    valor NUMERIC(10,2) NOT NULL,
    valor_pago NUMERIC(10,2),
    
    -- Status
    status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ATIVA', 'CONCLUIDA', 'REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP', 'EXPIRADA')),
    
    -- Datas
    data_criacao TIMESTAMPTZ DEFAULT now(),
    data_expiracao TIMESTAMPTZ,
    data_pagamento TIMESTAMPTZ,
    
    -- Pagador
    pagador_nome TEXT,
    pagador_documento TEXT,
    
    -- Metadados
    descricao TEXT,
    numero_pedido TEXT,
    webhook_recebido BOOLEAN DEFAULT false,
    webhook_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para cobrancas_pix
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_venda ON cobrancas_pix(venda_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_entrega ON cobrancas_pix(entrega_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_status ON cobrancas_pix(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_txid ON cobrancas_pix(stone_txid);
CREATE INDEX IF NOT EXISTS idx_cobrancas_pix_data ON cobrancas_pix(data_criacao);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_cobrancas_pix_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cobrancas_pix_updated_at ON cobrancas_pix;
CREATE TRIGGER trigger_cobrancas_pix_updated_at
    BEFORE UPDATE ON cobrancas_pix
    FOR EACH ROW
    EXECUTE FUNCTION update_cobrancas_pix_updated_at();

-- RLS para cobrancas_pix
ALTER TABLE cobrancas_pix ENABLE ROW LEVEL SECURITY;
CREATE POLICY cobrancas_pix_policy ON cobrancas_pix FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- FEATURE 5: Pedidos de Compra
-- ============================================

-- Tabela de pedidos de compra
CREATE TABLE IF NOT EXISTS pedidos_compra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_pedido TEXT UNIQUE,
    
    -- Fornecedor (BIGINT se fornecedores usa serial, UUID se usa gen_random_uuid)
    fornecedor_id BIGINT,
    fornecedor_nome TEXT,
    fornecedor_contato TEXT,
    fornecedor_email TEXT,
    
    -- Status e datas
    status TEXT DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Enviado', 'Confirmado', 'Parcialmente Recebido', 'Recebido', 'Cancelado')),
    data_pedido DATE,
    data_previsao_entrega DATE,
    data_entrega_real DATE,
    
    -- Valores
    valor_total NUMERIC(10,2) DEFAULT 0,
    valor_frete NUMERIC(10,2) DEFAULT 0,
    valor_desconto NUMERIC(10,2) DEFAULT 0,
    
    -- Informações adicionais
    observacoes TEXT,
    condicoes_pagamento TEXT,
    itens JSONB DEFAULT '[]',
    
    -- Controle
    criado_por UUID,
    criado_por_nome TEXT,
    email_enviado BOOLEAN DEFAULT false,
    data_email_enviado TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de itens do pedido de compra (normalizada)
CREATE TABLE IF NOT EXISTS itens_pedido_compra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_compra_id UUID,
    
    -- Produto (BIGINT se produtos usa serial)
    produto_id BIGINT,
    produto_nome TEXT NOT NULL,
    produto_codigo TEXT,
    
    -- Quantidades
    quantidade_pedida INTEGER NOT NULL CHECK (quantidade_pedida > 0),
    quantidade_recebida INTEGER DEFAULT 0 CHECK (quantidade_recebida >= 0),
    
    -- Valores
    preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
    preco_total NUMERIC(10,2) GENERATED ALWAYS AS (quantidade_pedida * preco_unitario) STORED,
    
    -- Status do item
    status TEXT DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Parcial', 'Completo', 'Cancelado')),
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para pedidos_compra
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_fornecedor ON pedidos_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON pedidos_compra(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_data ON pedidos_compra(data_pedido);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_produto ON itens_pedido_compra(produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_compra ON itens_pedido_compra(pedido_compra_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_pedidos_compra_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pedidos_compra_updated_at ON pedidos_compra;
CREATE TRIGGER trigger_pedidos_compra_updated_at
    BEFORE UPDATE ON pedidos_compra
    FOR EACH ROW
    EXECUTE FUNCTION update_pedidos_compra_updated_at();

-- Função para gerar número do pedido de compra
CREATE OR REPLACE FUNCTION gerar_numero_pedido_compra()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_numero INTEGER;
    novo_numero TEXT;
BEGIN
    IF NEW.numero_pedido IS NULL THEN
        SELECT COALESCE(MAX(CAST(SUBSTRING(numero_pedido FROM 4) AS INTEGER)), 0)
        INTO ultimo_numero
        FROM pedidos_compra
        WHERE numero_pedido LIKE 'PC-%';
        
        novo_numero := 'PC-' || LPAD((ultimo_numero + 1)::TEXT, 5, '0');
        NEW.numero_pedido := novo_numero;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_gerar_numero_pedido_compra ON pedidos_compra;
CREATE TRIGGER trigger_gerar_numero_pedido_compra
    BEFORE INSERT ON pedidos_compra
    FOR EACH ROW
    EXECUTE FUNCTION gerar_numero_pedido_compra();

-- RLS para pedidos_compra
ALTER TABLE pedidos_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY pedidos_compra_policy ON pedidos_compra FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE itens_pedido_compra ENABLE ROW LEVEL SECURITY;
CREATE POLICY itens_pedido_compra_policy ON itens_pedido_compra FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- CONFIGURAÇÕES: Stone API
-- ============================================

-- Inserir configurações do Stone (se não existirem)
INSERT INTO configuracoes_sistema (chave, valor, descricao) VALUES 
    ('stone_client_id', '', 'Client ID da API Stone OpenBank'),
    ('stone_client_secret', '', 'Client Secret da API Stone OpenBank'),
    ('stone_account_id', '', 'Account ID da conta Stone'),
    ('stone_chave_pix', '', 'Chave PIX cadastrada na Stone'),
    ('stone_ambiente', 'sandbox', 'Ambiente Stone: sandbox ou production'),
    ('stone_webhook_secret', '', 'Secret para validação de webhooks'),
    ('google_maps_api_key', '', 'API Key do Google Maps para otimização de rotas')
ON CONFLICT (chave) DO NOTHING;

-- ============================================
-- FEATURE: Campos adicionais para exportação contábil
-- ============================================

-- Adicionar campos fiscais na tabela vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS codigo_cfop TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS codigo_ncm TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS natureza_operacao TEXT DEFAULT 'Venda de mercadoria';

-- Adicionar campos fiscais na tabela produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cest TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT '0';

-- Adicionar campos em fornecedores
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS estado TEXT;

-- ============================================
-- ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

-- Índice para busca de entregas por data
CREATE INDEX IF NOT EXISTS idx_entregas_data_status ON entregas(data_agendada, status);

-- Índice para busca de vendas por período
CREATE INDEX IF NOT EXISTS idx_vendas_data_loja ON vendas(data_venda, loja);

-- Índice para relatórios financeiros
CREATE INDEX IF NOT EXISTS idx_lancamentos_data_tipo ON lancamentos_financeiros(data_lancamento, tipo);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON cobrancas_pix TO authenticated;
GRANT ALL ON pedidos_compra TO authenticated;
GRANT ALL ON itens_pedido_compra TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
