-- Migration: add_vale_schedule_fields_to_colaboradores
-- Adds fields to control if employee receives vale and on which day.

ALTER TABLE colaboradores
ADD COLUMN IF NOT EXISTS recebe_vale BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dia_vale INTEGER DEFAULT 20;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'colaboradores_dia_vale_check'
    ) THEN
        ALTER TABLE colaboradores
        ADD CONSTRAINT colaboradores_dia_vale_check CHECK (dia_vale BETWEEN 1 AND 31);
    END IF;
END $$;

COMMENT ON COLUMN colaboradores.recebe_vale IS 'Indica se o colaborador recebe vale/adiantamento salarial';
COMMENT ON COLUMN colaboradores.dia_vale IS 'Dia do mês para pagamento do vale (1-31)';
