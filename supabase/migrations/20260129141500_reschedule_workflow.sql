-- Migration to add Reschedule Request Workflow columns to 'entregas' table

ALTER TABLE entregas
ADD COLUMN IF NOT EXISTS data_restricao date,
ADD COLUMN IF NOT EXISTS turno_restricao text,
ADD COLUMN IF NOT EXISTS motivo_restricao text;

-- Add index for performance on restriction checks
CREATE INDEX IF NOT EXISTS idx_entregas_data_restricao ON entregas(data_restricao);
