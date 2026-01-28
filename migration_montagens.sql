-- =====================================================
-- MIGRAÇÃO: Sistema de Gerenciamento de Montagens
-- Data: 2025-12-20
-- NOTA: Sem foreign keys para evitar conflitos de tipos
-- =====================================================

-- 1. Adicionar coluna tipo_entrega_padrao na tabela produtos
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS tipo_entrega_padrao text DEFAULT 'na_caixa';

COMMENT ON COLUMN produtos.tipo_entrega_padrao IS 'Define se o produto é normalmente entregue montado ou na caixa';

-- 2. Criar tabela de montadores
CREATE TABLE IF NOT EXISTS montadores (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    nome text NOT NULL,
    telefone text,
    email text,
    tipo text NOT NULL DEFAULT 'terceirizado',
    ativo boolean DEFAULT true,
    usuario_id uuid,
    created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE montadores IS 'Cadastro de montadores internos e terceirizados';

-- Índices para montadores
CREATE INDEX IF NOT EXISTS idx_montadores_tipo ON montadores(tipo);
CREATE INDEX IF NOT EXISTS idx_montadores_ativo ON montadores(ativo);
CREATE INDEX IF NOT EXISTS idx_montadores_usuario_id ON montadores(usuario_id);

-- RLS para montadores
ALTER TABLE montadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS montadores_policy ON montadores;
CREATE POLICY montadores_policy ON montadores FOR ALL USING (auth.role() = 'authenticated');

-- 3. Criar tabela de itens de montagem (sem foreign keys para evitar conflitos de tipos)
CREATE TABLE IF NOT EXISTS montagens_itens (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    entrega_id bigint,
    venda_id bigint,
    produto_id bigint,
    produto_nome text NOT NULL,
    quantidade integer NOT NULL DEFAULT 1,
    tipo_montagem text NOT NULL DEFAULT 'terceirizada',
    montador_id bigint,
    data_agendada date,
    horario_agendado text,
    status text DEFAULT 'pendente',
    cliente_nome text,
    cliente_telefone text,
    endereco text,
    numero_pedido text,
    observacoes text,
    notificacao_enviada boolean DEFAULT false,
    notificacao_lembrete_enviada boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE montagens_itens IS 'Itens individuais para montagem interna ou terceirizada';

-- Índices para montagens_itens
CREATE INDEX IF NOT EXISTS idx_montagens_itens_entrega_id ON montagens_itens(entrega_id);
CREATE INDEX IF NOT EXISTS idx_montagens_itens_venda_id ON montagens_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_montagens_itens_montador_id ON montagens_itens(montador_id);
CREATE INDEX IF NOT EXISTS idx_montagens_itens_tipo_montagem ON montagens_itens(tipo_montagem);
CREATE INDEX IF NOT EXISTS idx_montagens_itens_status ON montagens_itens(status);
CREATE INDEX IF NOT EXISTS idx_montagens_itens_data_agendada ON montagens_itens(data_agendada);

-- RLS para montagens_itens
ALTER TABLE montagens_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS montagens_itens_policy ON montagens_itens;
CREATE POLICY montagens_itens_policy ON montagens_itens FOR ALL USING (auth.role() = 'authenticated');

-- 4. Adicionar cargo "Montador Externo" se não existir
INSERT INTO cargos (nome, permissoes)
SELECT 'Montador Externo', '{"montagens": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cargos WHERE nome = 'Montador Externo');

-- 5. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_montagens_itens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_montagens_itens_updated_at ON montagens_itens;
CREATE TRIGGER trigger_montagens_itens_updated_at
    BEFORE UPDATE ON montagens_itens
    FOR EACH ROW
    EXECUTE FUNCTION update_montagens_itens_updated_at();

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
