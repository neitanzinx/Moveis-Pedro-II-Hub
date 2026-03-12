-- Add montagem related fields to entregas table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'tipo_montagem') THEN
        ALTER TABLE entregas ADD COLUMN tipo_montagem text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'montagem_status') THEN
        ALTER TABLE entregas ADD COLUMN montagem_status text DEFAULT 'Pendente';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'montagem_concluida_em') THEN
        ALTER TABLE entregas ADD COLUMN montagem_concluida_em timestamp with time zone;
    END IF;
END $$;
