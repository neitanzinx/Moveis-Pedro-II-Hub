-- Migration: Segurança no Cadastro de Usuários
-- Força valores seguros independente do que o frontend enviar

-- 0. Adicionar coluna observacoes se não existir
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS cargo_solicitado TEXT;

-- 1. Função que força valores seguros no INSERT
CREATE OR REPLACE FUNCTION force_safe_user_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- Força status pendente (ignora qualquer valor enviado)
    NEW.status_aprovacao := 'Pendente';
    
    -- Salva cargo solicitado em coluna separada
    IF NEW.cargo IS NOT NULL AND NEW.cargo != '' THEN
        NEW.cargo_solicitado := NEW.cargo;
    END IF;
    
    -- Força cargo para "Pendente Definição" (admin define depois)
    NEW.cargo := 'Pendente Definição';
    
    -- Garante data de criação
    NEW.created_at := COALESCE(NEW.created_at, NOW());
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger no INSERT da tabela public_users
DROP TRIGGER IF EXISTS trigger_force_safe_user_defaults ON public_users;

CREATE TRIGGER trigger_force_safe_user_defaults
    BEFORE INSERT ON public_users
    FOR EACH ROW
    EXECUTE FUNCTION force_safe_user_defaults();

-- 3. Garantir que somente admins podem alterar cargo/status
-- (via RLS - Row Level Security)

-- Habilitar RLS se não estiver
ALTER TABLE public_users ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário só pode ver seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public_users;
CREATE POLICY "Users can view own profile" ON public_users
    FOR SELECT
    USING (auth.uid() = id);

-- Policy: Admins podem ver todos
DROP POLICY IF EXISTS "Admins can view all" ON public_users;
CREATE POLICY "Admins can view all" ON public_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo = 'Administrador'
            AND status_aprovacao = 'Aprovado'
        )
    );

-- Policy: Admins podem fazer tudo
DROP POLICY IF EXISTS "Admins have full access" ON public_users;
CREATE POLICY "Admins have full access" ON public_users
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo = 'Administrador'
            AND status_aprovacao = 'Aprovado'
        )
    );

-- Policy: Service role pode tudo (para o backend)
DROP POLICY IF EXISTS "Service role bypass" ON public_users;
CREATE POLICY "Service role bypass" ON public_users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: INSERT permitido para novos usuários (trigger força valores seguros)
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public_users;
CREATE POLICY "Allow insert for authenticated" ON public_users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Nota: Execute este SQL no Supabase Dashboard > SQL Editor
