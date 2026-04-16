-- =====================================================================
-- MIGRATION: Solicitações de Reposição (Assistência → Compras)
-- Data: 2026-04-15
-- Descrição: Cria tabela para rastrear solicitações de reposição de
--            produtos geradas automaticamente ao concluir assistências
--            dos tipos "Troca" ou "Peça Faltante".
-- =====================================================================

CREATE TABLE IF NOT EXISTS solicitacoes_reposicao (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    assistencia_id  UUID REFERENCES assistencias_tecnicas(id) ON DELETE SET NULL,
    numero_assistencia VARCHAR(50),
    produto_id      BIGINT,
    produto_nome    VARCHAR(255),
    quantidade      INTEGER NOT NULL DEFAULT 1,
    loja_id         UUID REFERENCES lojas(id) ON DELETE SET NULL,
    loja_nome       VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'Pendente'
                    CHECK (status IN ('Pendente', 'Em Compra', 'Resolvida', 'Cancelada')),
    observacoes     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS idx_solicitacoes_reposicao_status
    ON solicitacoes_reposicao(status);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_reposicao_assistencia
    ON solicitacoes_reposicao(assistencia_id);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_reposicao_produto
    ON solicitacoes_reposicao(produto_id);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_reposicao_loja
    ON solicitacoes_reposicao(loja_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_solicitacoes_reposicao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_solicitacoes_reposicao_updated_at
    BEFORE UPDATE ON solicitacoes_reposicao
    FOR EACH ROW
    EXECUTE FUNCTION update_solicitacoes_reposicao_updated_at();

-- RLS: Habilitar segurança em nível de linha
ALTER TABLE solicitacoes_reposicao ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler/escrever (ajustar conforme políticas RLS do projeto)
CREATE POLICY "Authenticated users can manage solicitacoes_reposicao"
    ON solicitacoes_reposicao
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Comentários de documentação
COMMENT ON TABLE solicitacoes_reposicao IS
    'Solicitações de reposição de produto geradas ao concluir assistências técnicas de Troca ou Peça Faltante. Alimenta o módulo de Compras para rastreamento.';

COMMENT ON COLUMN solicitacoes_reposicao.status IS
    'Pendente: aguardando ação do comprador | Em Compra: OC criada | Resolvida: produto reposto | Cancelada';
