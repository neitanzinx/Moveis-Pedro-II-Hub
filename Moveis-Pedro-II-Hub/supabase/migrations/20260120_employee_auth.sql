-- ================================================
-- MIGRATION: Sistema de Autenticação por Matrícula
-- ================================================

-- 1. Adicionar campos de autenticação para funcionários na tabela public_users
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS matricula VARCHAR(20) UNIQUE;
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS primeiro_acesso BOOLEAN DEFAULT true;
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS ultimo_login TIMESTAMPTZ;

-- 2. Índice para busca rápida por matrícula
CREATE INDEX IF NOT EXISTS idx_public_users_matricula ON public_users(matricula);

-- 3. Tabela de sequência para geração de matrículas por setor
CREATE TABLE IF NOT EXISTS matricula_sequences (
    setor_code VARCHAR(2) PRIMARY KEY,
    setor_nome VARCHAR(50) NOT NULL,
    ultimo_numero INTEGER DEFAULT 0
);

-- 4. Inserir setores padrão
INSERT INTO matricula_sequences (setor_code, setor_nome, ultimo_numero) VALUES
    ('VE', 'Vendas', 0),
    ('LO', 'Logística', 0),
    ('MO', 'Montagem', 0),
    ('AD', 'Administrativo', 0),
    ('FI', 'Financeiro', 0),
    ('RH', 'RH', 0),
    ('ES', 'Estoque', 0),
    ('AT', 'Atendimento', 0),
    ('GE', 'Gerência', 0),
    ('TI', 'TI', 0)
ON CONFLICT (setor_code) DO NOTHING;

-- 5. Função para gerar próxima matrícula
CREATE OR REPLACE FUNCTION gerar_proxima_matricula(p_setor_code VARCHAR(2))
RETURNS VARCHAR(20) AS $$
DECLARE
    v_proximo_numero INTEGER;
    v_matricula VARCHAR(20);
BEGIN
    -- Atualiza e retorna o próximo número atomicamente
    UPDATE matricula_sequences 
    SET ultimo_numero = ultimo_numero + 1 
    WHERE setor_code = p_setor_code
    RETURNING ultimo_numero INTO v_proximo_numero;
    
    -- Formata a matrícula: MP-XX0000
    v_matricula := 'MP-' || p_setor_code || LPAD(v_proximo_numero::TEXT, 4, '0');
    
    RETURN v_matricula;
END;
$$ LANGUAGE plpgsql;

-- 6. Comentários para documentação
COMMENT ON COLUMN public_users.matricula IS 'Matrícula única do funcionário no formato MP-XX0000';
COMMENT ON COLUMN public_users.senha_hash IS 'Hash bcrypt da senha do funcionário';
COMMENT ON COLUMN public_users.ativo IS 'Se o funcionário está ativo e pode fazer login';
COMMENT ON COLUMN public_users.primeiro_acesso IS 'Se é o primeiro acesso e precisa trocar senha';
COMMENT ON COLUMN public_users.ultimo_login IS 'Data/hora do último login bem-sucedido';
