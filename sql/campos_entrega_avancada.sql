-- SQL para adicionar campos de entrega avançada
-- Execute no SQL Editor do Supabase

-- Adicionar campos para assinatura, comprovantes e pagamento
DO $$
BEGIN
    -- Campo para URL da assinatura digital do cliente
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'assinatura_url') THEN
        ALTER TABLE entregas ADD COLUMN assinatura_url TEXT;
    END IF;
    
    -- Campo para URL do comprovante de pagamento
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'comprovante_pagamento_url') THEN
        ALTER TABLE entregas ADD COLUMN comprovante_pagamento_url TEXT;
    END IF;
    
    -- Campo para URL da foto quando não conseguiu entregar
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'foto_tentativa_url') THEN
        ALTER TABLE entregas ADD COLUMN foto_tentativa_url TEXT;
    END IF;
    
    -- Campo para observações da entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'observacoes_entrega') THEN
        ALTER TABLE entregas ADD COLUMN observacoes_entrega TEXT;
    END IF;
    
    -- Campo para indicar se tem pagamento na entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'pagamento_na_entrega') THEN
        ALTER TABLE entregas ADD COLUMN pagamento_na_entrega BOOLEAN DEFAULT false;
    END IF;
    
    -- Campo para forma de pagamento esperada
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'forma_pagamento') THEN
        ALTER TABLE entregas ADD COLUMN forma_pagamento VARCHAR(50);
    END IF;
    
    -- Campo para valor a receber na entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'valor_a_receber') THEN
        ALTER TABLE entregas ADD COLUMN valor_a_receber DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Campo para data/hora realizada
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'data_realizada') THEN
        ALTER TABLE entregas ADD COLUMN data_realizada TIMESTAMPTZ;
    END IF;
    
    -- Campo para tentativas de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'entregas' AND column_name = 'tentativas') THEN
        ALTER TABLE entregas ADD COLUMN tentativas INTEGER DEFAULT 0;
    END IF;
END $$;

-- Criar bucket no Storage para arquivos de entrega (executar separadamente se necessário)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('entregas', 'entregas', true) ON CONFLICT DO NOTHING;
