-- Vinculo entre montagens e assistencias abertas no painel de montadores
ALTER TABLE IF EXISTS montagens_itens
    ADD COLUMN IF NOT EXISTS tem_problema BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS assistencia_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_montagens_itens_assistencia'
    ) THEN
        ALTER TABLE montagens_itens
            ADD CONSTRAINT fk_montagens_itens_assistencia
            FOREIGN KEY (assistencia_id)
            REFERENCES assistencias_tecnicas(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_montagens_itens_tem_problema
    ON montagens_itens (tem_problema);

CREATE INDEX IF NOT EXISTS idx_montagens_itens_assistencia_id
    ON montagens_itens (assistencia_id);
