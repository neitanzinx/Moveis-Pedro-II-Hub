-- =============================================================================
-- MIGRATION: Advanced HR Module
-- Run this script in Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXPAND colaboradores TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public_users(id);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS banco text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS agencia text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS conta text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS pix text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS salario_base numeric(10,2);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tipo_contrato text; -- CLT, PJ, Estagiário, Temporário
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS carga_horaria integer; -- Horas por semana
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS data_demissao date;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS motivo_demissao text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS observacoes text;

-- Indexes for colaboradores
CREATE INDEX IF NOT EXISTS idx_colaboradores_user_id ON colaboradores(user_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaboradores_setor ON colaboradores(setor);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cargo ON colaboradores(cargo);

-- -----------------------------------------------------------------------------
-- 2. CREATE/UPDATE folhas_pagamento TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folhas_pagamento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id uuid REFERENCES colaboradores(id) ON DELETE CASCADE,
    colaborador_nome text,
    mes_referencia integer NOT NULL, -- 1-12
    ano_referencia integer NOT NULL,
    salario_bruto numeric(10,2) DEFAULT 0,
    inss numeric(10,2) DEFAULT 0,
    irrf numeric(10,2) DEFAULT 0,
    fgts numeric(10,2) DEFAULT 0,
    vale_transporte numeric(10,2) DEFAULT 0,
    vale_refeicao numeric(10,2) DEFAULT 0,
    outros_descontos numeric(10,2) DEFAULT 0,
    descricao_outros_descontos text,
    outros_beneficios numeric(10,2) DEFAULT 0,
    descricao_outros_beneficios text,
    horas_extras numeric(10,2) DEFAULT 0,
    valor_horas_extras numeric(10,2) DEFAULT 0,
    salario_liquido numeric(10,2) DEFAULT 0,
    status text DEFAULT 'Gerado', -- Gerado, Pago, Cancelado
    data_pagamento date,
    observacoes text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(colaborador_id, mes_referencia, ano_referencia)
);

-- Indexes for folhas_pagamento
CREATE INDEX IF NOT EXISTS idx_folhas_pagamento_colaborador ON folhas_pagamento(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_folhas_pagamento_periodo ON folhas_pagamento(ano_referencia, mes_referencia);
CREATE INDEX IF NOT EXISTS idx_folhas_pagamento_status ON folhas_pagamento(status);

-- RLS for folhas_pagamento
ALTER TABLE folhas_pagamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS folhas_pagamento_policy ON folhas_pagamento;
CREATE POLICY folhas_pagamento_policy ON folhas_pagamento FOR ALL USING (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 3. UPDATE/CREATE avaliacoes_desempenho TABLE
-- First add columns to existing table if it exists
-- -----------------------------------------------------------------------------
-- Add columns if the table exists (these will be ignored if table doesn't exist)
DO $$
BEGIN
    -- Add avaliador_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='avaliador_id') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN avaliador_id uuid REFERENCES public_users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='avaliador_nome') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN avaliador_nome text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='colaborador_nome') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN colaborador_nome text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='tipo') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN tipo text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='data_avaliacao') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN data_avaliacao date DEFAULT CURRENT_DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='periodo_inicio') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN periodo_inicio date;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='periodo_fim') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN periodo_fim date;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='competencias') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN competencias jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='pontuacao_media') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN pontuacao_media numeric(3,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='pontos_fortes') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN pontos_fortes text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='pontos_melhorar') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN pontos_melhorar text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='metas_definidas') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN metas_definidas text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='comentarios_gerais') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN comentarios_gerais text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='avaliacoes_desempenho' AND column_name='status') THEN
        ALTER TABLE avaliacoes_desempenho ADD COLUMN status text DEFAULT 'Rascunho';
    END IF;
    
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, create it fresh
        CREATE TABLE avaliacoes_desempenho (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            colaborador_id uuid REFERENCES colaboradores(id) ON DELETE CASCADE,
            colaborador_nome text,
            avaliador_id uuid REFERENCES public_users(id),
            avaliador_nome text,
            tipo text,
            data_avaliacao date DEFAULT CURRENT_DATE,
            periodo_inicio date,
            periodo_fim date,
            competencias jsonb,
            pontuacao_media numeric(3,2),
            pontos_fortes text,
            pontos_melhorar text,
            metas_definidas text,
            comentarios_gerais text,
            status text DEFAULT 'Rascunho',
            created_at timestamptz DEFAULT now()
        );
END $$;

-- Indexes for avaliacoes_desempenho (only create if columns exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='avaliacoes_desempenho' AND column_name='colaborador_id') THEN
        CREATE INDEX IF NOT EXISTS idx_avaliacoes_colaborador ON avaliacoes_desempenho(colaborador_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='avaliacoes_desempenho' AND column_name='avaliador_id') THEN
        CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliador ON avaliacoes_desempenho(avaliador_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='avaliacoes_desempenho' AND column_name='status') THEN
        CREATE INDEX IF NOT EXISTS idx_avaliacoes_status ON avaliacoes_desempenho(status);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='avaliacoes_desempenho' AND column_name='data_avaliacao') THEN
        CREATE INDEX IF NOT EXISTS idx_avaliacoes_data ON avaliacoes_desempenho(data_avaliacao);
    END IF;
END $$;

-- RLS for avaliacoes_desempenho
ALTER TABLE avaliacoes_desempenho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avaliacoes_desempenho_policy ON avaliacoes_desempenho;
CREATE POLICY avaliacoes_desempenho_policy ON avaliacoes_desempenho FOR ALL USING (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 4. CREATE/UPDATE documentos_rh TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_rh (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id uuid REFERENCES colaboradores(id) ON DELETE CASCADE,
    colaborador_nome text,
    tipo text, -- Contrato, Atestado, Certificado, Advertência, Outros
    titulo text NOT NULL,
    descricao text,
    arquivo_url text,
    data_documento date,
    data_upload timestamptz DEFAULT now(),
    uploaded_by uuid REFERENCES public_users(id),
    created_at timestamptz DEFAULT now()
);

-- Add columns if table already exists
ALTER TABLE documentos_rh ADD COLUMN IF NOT EXISTS colaborador_nome text;
ALTER TABLE documentos_rh ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE documentos_rh ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES public_users(id);

-- Indexes for documentos_rh
CREATE INDEX IF NOT EXISTS idx_documentos_colaborador ON documentos_rh(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos_rh(tipo);

-- RLS for documentos_rh
ALTER TABLE documentos_rh ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documentos_rh_policy ON documentos_rh;
CREATE POLICY documentos_rh_policy ON documentos_rh FOR ALL USING (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 5. CREATE ponto_eletronico TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ponto_eletronico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id uuid REFERENCES colaboradores(id) ON DELETE CASCADE,
    colaborador_nome text,
    data date NOT NULL,
    hora_entrada time,
    hora_saida_almoco time,
    hora_volta_almoco time,
    hora_saida time,
    horas_trabalhadas numeric(4,2),
    horas_extras numeric(4,2) DEFAULT 0,
    observacoes text,
    aprovado boolean DEFAULT false,
    aprovado_por uuid REFERENCES public_users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE(colaborador_id, data)
);

-- Indexes for ponto_eletronico
CREATE INDEX IF NOT EXISTS idx_ponto_colaborador ON ponto_eletronico(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ponto_data ON ponto_eletronico(data);

-- RLS for ponto_eletronico
ALTER TABLE ponto_eletronico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ponto_eletronico_policy ON ponto_eletronico;
CREATE POLICY ponto_eletronico_policy ON ponto_eletronico FOR ALL USING (auth.role() = 'authenticated');

-- -----------------------------------------------------------------------------
-- 6. ALTER licencas TABLE (add quantidade_dias if missing)
-- -----------------------------------------------------------------------------
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS quantidade_dias integer;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS data_fim date;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS motivo text;
ALTER TABLE licencas ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES public_users(id);

-- -----------------------------------------------------------------------------
-- 7. ALTER ferias TABLE (add more fields)
-- -----------------------------------------------------------------------------
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS tipo text; -- Normal, Fracionada, Vendida
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS dias_vendidos integer DEFAULT 0;
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS valor_abono numeric(10,2);
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES public_users(id);
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS data_solicitacao date;
ALTER TABLE ferias ADD COLUMN IF NOT EXISTS observacoes text;

-- -----------------------------------------------------------------------------
-- 8. ALTER vagas TABLE (add more fields)
-- -----------------------------------------------------------------------------
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS requisitos text;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS beneficios text;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS salario_min numeric(10,2);
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS salario_max numeric(10,2);
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS tipo_contrato text;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS carga_horaria integer;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS data_fechamento date;
ALTER TABLE vagas ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public_users(id);

-- -----------------------------------------------------------------------------
-- 9. ALTER candidatos TABLE (add pipeline fields)
-- -----------------------------------------------------------------------------
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS data_candidatura date DEFAULT CURRENT_DATE;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fonte text; -- LinkedIn, Indicação, Site, etc.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS nota_entrevista numeric(3,2);
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS comentarios text;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS data_entrevista date;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS entrevistador_id uuid REFERENCES public_users(id);
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS proposta_salarial numeric(10,2);
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS data_contratacao date;

-- -----------------------------------------------------------------------------
-- 10. ALTER comunicados_rh TABLE (add more fields)
-- -----------------------------------------------------------------------------
ALTER TABLE comunicados_rh ADD COLUMN IF NOT EXISTS prioridade text; -- Alta, Média, Baixa
ALTER TABLE comunicados_rh ADD COLUMN IF NOT EXISTS data_expiracao date;
ALTER TABLE comunicados_rh ADD COLUMN IF NOT EXISTS destinatarios text; -- Todos, Setor específico, etc.
ALTER TABLE comunicados_rh ADD COLUMN IF NOT EXISTS anexo_url text;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
