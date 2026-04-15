-- ============================================================
-- MIGRATION: Fluxo de Aprovação Fiscal para NF-e
-- Data: 2026-04-07
-- Objetivo: Adicionar estados formais de solicitação e aprovação
--           de NF-e na tabela vendas, tabela de eventos fiscais,
--           tabela de CC-e e colunas de emitente na config.
-- ============================================================

-- ── 1. Colunas de fluxo fiscal na tabela vendas ──────────────────────────────
-- Estados do fluxo:
--   nfe_solicitada=false → cliente não pediu NF-e
--   nfe_solicitada=true + nfe_aprovada=false → aguardando aprovação gerencial
--   nfe_solicitada=true + nfe_aprovada=true  → aprovada, pode emitir
--   nfe_emitida=true → NF-e emitida (status em nfe_status)
--   nfe_reprovada=true → reprovada, requer nova solicitação

ALTER TABLE vendas
    ADD COLUMN IF NOT EXISTS nfe_solicitada       BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS nfe_aprovada         BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS nfe_aprovada_por     TEXT,
    ADD COLUMN IF NOT EXISTS nfe_aprovada_em      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS nfe_reprovada        BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS nfe_reprovada_motivo TEXT;

-- Índice para filtrar vendas com NF-e pendente de aprovação
CREATE INDEX IF NOT EXISTS idx_vendas_nfe_solicitada ON vendas(nfe_solicitada)
    WHERE nfe_solicitada = true;

-- ── 2. Colunas de emitente na config do tenant ────────────────────────────────
-- Move dados do emitente para o banco (sai do localStorage do navegador)
ALTER TABLE organization_nfe_configs
    ADD COLUMN IF NOT EXISTS emitente_cnpj             TEXT,
    ADD COLUMN IF NOT EXISTS emitente_nome             TEXT,
    ADD COLUMN IF NOT EXISTS emitente_ie               TEXT,
    ADD COLUMN IF NOT EXISTS emitente_uf               TEXT DEFAULT 'ES',
    ADD COLUMN IF NOT EXISTS emitente_crt              INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS emitente_logradouro       TEXT,
    ADD COLUMN IF NOT EXISTS emitente_numero           TEXT,
    ADD COLUMN IF NOT EXISTS emitente_bairro           TEXT,
    ADD COLUMN IF NOT EXISTS emitente_municipio        TEXT,
    ADD COLUMN IF NOT EXISTS emitente_cep              TEXT,
    ADD COLUMN IF NOT EXISTS emitente_codigo_municipio TEXT;

-- ── 3. Tabela de eventos fiscais (auditoria completa) ─────────────────────────
CREATE TABLE IF NOT EXISTS nfe_eventos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venda_id         TEXT NOT NULL,
    nfe_ref          TEXT,                        -- ID na Nuvem Fiscal
    tipo_evento      TEXT NOT NULL,               -- 'solicitacao_emissao', 'aprovacao_emissao',
                                                  -- 'reprovacao_emissao', 'emissao_enviada',
                                                  -- 'status_atualizado', 'cancelamento', 'carta_correcao'
    status_anterior  TEXT,
    status_novo      TEXT,
    codigo_sefaz     INTEGER,
    motivo_sefaz     TEXT,
    protocolo        TEXT,
    dados_resposta   JSONB,
    realizado_por    TEXT,
    realizado_por_id TEXT,
    created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfe_eventos_venda  ON nfe_eventos(venda_id);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_ref    ON nfe_eventos(nfe_ref);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_tipo   ON nfe_eventos(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_nfe_eventos_data   ON nfe_eventos(created_at DESC);

ALTER TABLE nfe_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_eventos_policy ON nfe_eventos;
CREATE POLICY nfe_eventos_policy ON nfe_eventos
    FOR ALL USING (auth.role() = 'authenticated');

-- ── 4. Tabela de Carta de Correção (CC-e) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS nfe_carta_correcao (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nota_fiscal_id      UUID REFERENCES notas_fiscais_emitidas(id) ON DELETE CASCADE,
    nfe_ref             TEXT NOT NULL,            -- ID na Nuvem Fiscal
    sequencia           INTEGER NOT NULL DEFAULT 1, -- Máx 20 por NF-e
    descricao_correcao  TEXT NOT NULL,
    status              TEXT,                     -- 'enviado', 'autorizado', 'erro'
    protocolo           TEXT,
    data_evento         TIMESTAMPTZ,
    criado_por          TEXT,
    criado_por_id       TEXT,
    dados_resposta      JSONB,
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (nota_fiscal_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_nfe_cce_nota    ON nfe_carta_correcao(nota_fiscal_id);
CREATE INDEX IF NOT EXISTS idx_nfe_cce_ref     ON nfe_carta_correcao(nfe_ref);

ALTER TABLE nfe_carta_correcao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfe_cce_policy ON nfe_carta_correcao;
CREATE POLICY nfe_cce_policy ON nfe_carta_correcao
    FOR ALL USING (auth.role() = 'authenticated');

-- ── 5. Corrigir tipo da coluna ambiente em notas_fiscais_emitidas ─────────────
-- A coluna foi inserida como inteiro (1/2) em versões anteriores.
-- Garante que o tipo seja TEXT e migra dados históricos se necessário.
DO $$
BEGIN
    -- Só executa se a coluna existir e contiver valores numéricos
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notas_fiscais_emitidas'
          AND column_name = 'ambiente'
          AND data_type IN ('integer', 'bigint', 'smallint')
    ) THEN
        ALTER TABLE notas_fiscais_emitidas
            ALTER COLUMN ambiente TYPE TEXT USING
                CASE ambiente::text
                    WHEN '1' THEN 'producao'
                    WHEN '2' THEN 'homologacao'
                    ELSE ambiente::text
                END;
    END IF;
END
$$;

-- ── 6. Backfill: vendas já emitidas marcadas como aprovadas ──────────────────
-- Vendas com NF-e autorizada anterior ao fluxo de aprovação
-- são consideradas automaticamente aprovadas para não quebrar histórico.
UPDATE vendas
SET nfe_aprovada    = true,
    nfe_solicitada  = true
WHERE nfe_emitida   = true
  AND (nfe_aprovada = false OR nfe_aprovada IS NULL);

-- ── 7. Comentários nas colunas novas ─────────────────────────────────────────
COMMENT ON COLUMN vendas.nfe_solicitada       IS 'True quando cliente solicitou a NF-e';
COMMENT ON COLUMN vendas.nfe_aprovada         IS 'True quando gerente/admin aprovou a emissão';
COMMENT ON COLUMN vendas.nfe_aprovada_por     IS 'Nome do usuário que aprovou';
COMMENT ON COLUMN vendas.nfe_aprovada_em      IS 'Timestamp da aprovação';
COMMENT ON COLUMN vendas.nfe_reprovada        IS 'True quando emissão foi reprovada';
COMMENT ON COLUMN vendas.nfe_reprovada_motivo IS 'Motivo da reprovação informado pelo gerente';
