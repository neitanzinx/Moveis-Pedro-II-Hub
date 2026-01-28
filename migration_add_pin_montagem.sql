-- =============================================================================
-- MIGRATION: Add PIN for Assemblers
-- Purpose: Add a secure PIN column for internal assemblers to authorize actions.
-- =============================================================================

ALTER TABLE colaboradores
ADD COLUMN IF NOT EXISTS pin_montagem TEXT; -- Using TEXT to allow leading zeros (e.g., "0123")

COMMENT ON COLUMN colaboradores.pin_montagem IS '4-digit PIN for internal assembler authorization';
