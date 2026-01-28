-- SQL para adicionar campos de rastreamento de notificação
-- Execute no SQL Editor do Supabase

DO $$
BEGIN
    -- Campo para data em que foi notificado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'data_notificacao') THEN
        ALTER TABLE entregas ADD COLUMN data_notificacao DATE;
    END IF;
    
    -- Campo para turno em que foi notificado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'turno_notificacao') THEN
        ALTER TABLE entregas ADD COLUMN turno_notificacao VARCHAR(50);
    END IF;
    
    -- Campo para timestamp da última notificação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'ultima_notificacao') THEN
        ALTER TABLE entregas ADD COLUMN ultima_notificacao TIMESTAMPTZ;
    END IF;
END $$;
