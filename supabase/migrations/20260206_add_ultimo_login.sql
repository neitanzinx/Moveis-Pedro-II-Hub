-- Migration: add_ultimo_login_to_public_users
-- Adiciona a coluna ultimo_login se ela não existir

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'public_users' AND column_name = 'ultimo_login') THEN 
        ALTER TABLE public_users ADD COLUMN ultimo_login TIMESTAMPTZ; 
    END IF; 
END $$;

-- Permitir update na coluna ultimo_login para usuários autenticados (para o próprio usuário atualizar seu login)
-- A política existente já deve cobrir se for "Users can update own profile", mas vamos garantir.
-- Se RLS estiver ativado e restritivo, o update pode falhar.
-- Vamos confiar que a política de UPDATE existente ou a permissão de service role (se fosse usado) resolveria.
-- Como o LoginFuncionario usa o cliente anon/auth, ele atua como o usuário logado.
-- O usuário precisa ter permissão de UPDATE na tabela public_users para sua própria linha.

-- Verifica se existe política de update para own profile, se não cria uma genérica
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'public_users' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON public_users
        FOR UPDATE TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END $$;
