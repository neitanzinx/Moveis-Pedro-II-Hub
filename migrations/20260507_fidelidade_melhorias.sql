-- ============================================================
-- Migração: Expansão do Sistema de Fidelidade (Coroas)
-- Data: 2026-05-07
-- Descrição: Adiciona novos gatilhos de ganho, histórico,
--            categorias bônus, expiração e resgate por desconto.
-- ============================================================

-- ─── 1. EXPANDIR fidelidade_config ────────────────────────────────────────────

-- Gatilho: Aniversário
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS aniversario_ativo      BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS aniversario_coroas      INTEGER DEFAULT 50;

-- Gatilho: Indicação de amigo
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS indicacao_ativo         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS indicacao_coroas        INTEGER DEFAULT 30;

-- Gatilho: Avaliação / feedback
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS avaliacao_ativo         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliacao_coroas        INTEGER DEFAULT 10;

-- Gatilho: Frequência (compras por mês)
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS frequencia_ativo        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequencia_coroas       INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS frequencia_minima       INTEGER DEFAULT 2;

-- Gatilho: Produto/categoria específico
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS produto_especifico_ativo BOOLEAN DEFAULT false;

-- Gatilho: Pagamento à vista
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS pagamento_avista_ativo  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagamento_avista_coroas INTEGER DEFAULT 10;

-- Campanhas manuais
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS campanha_manual_ativo   BOOLEAN DEFAULT true;

-- Resgate
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS desconto_por_coroa      NUMERIC(10,4) DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS reward_threshold        INTEGER DEFAULT 100;

-- Expiração
ALTER TABLE fidelidade_config
  ADD COLUMN IF NOT EXISTS expiracao_ativo         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiracao_valor         INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS expiracao_unidade       TEXT DEFAULT 'meses'
    CHECK (expiracao_unidade IN ('horas','dias','semanas','meses','anos'));

-- ─── 2. CRIAR fidelidade_historico ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fidelidade_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_evento     TEXT NOT NULL CHECK (tipo_evento IN (
    'compra','cadastro','aniversario','indicacao','avaliacao',
    'frequencia','produto_especifico','pagamento_avista',
    'campanha','resgate','expiracao'
  )),
  coroas          INTEGER NOT NULL,   -- positivo = ganho, negativo = dedução
  descricao       TEXT,
  referencia_id   UUID,               -- id da venda, recompensa, etc.
  saldo_apos      INTEGER,            -- saldo do cliente após o evento
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fidelidade_historico_cliente
  ON fidelidade_historico (cliente_id, created_at DESC);

-- ─── 3. CRIAR fidelidade_categorias_bonus ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS fidelidade_categorias_bonus (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT NOT NULL,
  coroas_bonus    INTEGER NOT NULL DEFAULT 0,
  multiplicador   NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. CAMPOS EXTRAS EM clientes ─────────────────────────────────────────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS indicado_por                BIGINT REFERENCES clientes(id),
  ADD COLUMN IF NOT EXISTS aniversario_fidelidade_ano  INTEGER,
  ADD COLUMN IF NOT EXISTS ultima_avaliacao_fidelidade TIMESTAMPTZ;

-- ─── 5. CRIAR/GARANTIR TIERS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fidelidade_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  coroas_minimas    INTEGER NOT NULL DEFAULT 0,
  multiplicador_coroas NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  ordem             INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fidelidade_tiers_coroas
  ON fidelidade_tiers (coroas_minimas ASC);

ALTER TABLE fidelidade_tiers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fidelidade_tiers' AND policyname = 'employees_all_tiers'
  ) THEN
    CREATE POLICY employees_all_tiers
      ON fidelidade_tiers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ─── 5b. ADICIONAR tier_id EM clientes (usado pelo engine) ───────────────────

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tier_id UUID REFERENCES fidelidade_tiers(id);

-- ─── 5c. SEED: TIERS PADRÃO ──────────────────────────────────────────────────
-- Insere somente se a tabela estiver vazia (para não duplicar)

INSERT INTO fidelidade_tiers (nome, coroas_minimas, multiplicador_coroas, is_active, ordem)
SELECT nome, coroas_minimas, multiplicador_coroas, is_active, ordem FROM (VALUES
  ('Bronze',   0,    1.00, true, 1),
  ('Prime',    100,  1.20, true, 2),
  ('Master',   500,  1.50, true, 3),
  ('Elite',    1000, 2.00, true, 4)
) AS defaults(nome, coroas_minimas, multiplicador_coroas, is_active, ordem)
WHERE NOT EXISTS (SELECT 1 FROM fidelidade_tiers LIMIT 1);

-- ─── 6. RLS: fidelidade_historico ─────────────────────────────────────────────

ALTER TABLE fidelidade_historico ENABLE ROW LEVEL SECURITY;

-- Funcionários autenticados podem ler e inserir qualquer registro
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fidelidade_historico' AND policyname = 'employees_all_historico'
  ) THEN
    CREATE POLICY employees_all_historico
      ON fidelidade_historico FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- ─── 7. RLS: fidelidade_categorias_bonus ──────────────────────────────────────

ALTER TABLE fidelidade_categorias_bonus ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fidelidade_categorias_bonus' AND policyname = 'employees_all_categorias_bonus'
  ) THEN
    CREATE POLICY employees_all_categorias_bonus
      ON fidelidade_categorias_bonus FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;
