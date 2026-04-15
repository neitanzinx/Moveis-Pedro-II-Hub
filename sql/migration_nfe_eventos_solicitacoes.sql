-- ============================================================
-- MIGRATION: Workflow de Solicitacoes de Eventos NF-e
-- Data: 2026-04-07
-- Objetivo: Suportar fluxo em 2 etapas (solicitar/aprovar/executar)
--           para cancelamento, carta de correcao e inutilizacao.
-- ============================================================

CREATE TABLE IF NOT EXISTS nfe_eventos_solicitacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    venda_id TEXT,
    nfe_ref TEXT,
    ambiente TEXT NOT NULL DEFAULT 'homologacao',
    tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('cancelamento', 'carta_correcao', 'inutilizacao')),
    status_solicitacao TEXT NOT NULL DEFAULT 'pendente_aprovacao' CHECK (
        status_solicitacao IN (
            'pendente_aprovacao',
            'aprovado',
            'reprovado',
            'executando',
            'executado',
            'erro_execucao'
        )
    ),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    mensagem_status TEXT,
    solicitante_nome TEXT,
    solicitante_id TEXT,
    aprovador_nome TEXT,
    aprovador_id TEXT,
    reprovado_motivo TEXT,
    executado_por_nome TEXT,
    executado_por_id TEXT,
    protocolo TEXT,
    dados_resposta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_eventos_sol_org ON nfe_eventos_solicitacoes(organization_id);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_sol_ref ON nfe_eventos_solicitacoes(nfe_ref);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_sol_venda ON nfe_eventos_solicitacoes(venda_id);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_sol_tipo_status ON nfe_eventos_solicitacoes(tipo_evento, status_solicitacao);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_sol_created ON nfe_eventos_solicitacoes(created_at DESC);

ALTER TABLE nfe_eventos_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nfe_eventos_solicitacoes_policy ON nfe_eventos_solicitacoes;
CREATE POLICY nfe_eventos_solicitacoes_policy ON nfe_eventos_solicitacoes
    FOR ALL USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION set_updated_at_nfe_eventos_solicitacoes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfe_eventos_solicitacoes_updated_at ON nfe_eventos_solicitacoes;
CREATE TRIGGER trg_nfe_eventos_solicitacoes_updated_at
BEFORE UPDATE ON nfe_eventos_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_nfe_eventos_solicitacoes();

COMMENT ON TABLE nfe_eventos_solicitacoes IS 'Workflow de solicitacao/aprovacao/execucao de eventos fiscais NF-e';
COMMENT ON COLUMN nfe_eventos_solicitacoes.payload IS 'Dados do evento (justificativa, descricao_correcao, faixa inutilizacao etc.)';
