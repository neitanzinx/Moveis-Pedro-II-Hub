-- URGENTE: Corrigir recursão infinita no public_users
-- Execute no Supabase Dashboard > SQL Editor AGORA

-- 1. Remover TODAS as policies (incluindo as novas)
DROP POLICY IF EXISTS "Users can view own profile" ON public_users;
DROP POLICY IF EXISTS "Admins can view all" ON public_users;
DROP POLICY IF EXISTS "Admins have full access" ON public_users;
DROP POLICY IF EXISTS "Service role bypass" ON public_users;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public_users;
DROP POLICY IF EXISTS "Authenticated users can view all" ON public_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public_users;
DROP POLICY IF EXISTS "Allow insert for new users" ON public_users;
DROP POLICY IF EXISTS "Service role full access" ON public_users;
DROP POLICY IF EXISTS "Service role can delete" ON public_users;

-- 2. Criar policies simples SEM recursão

-- Todos autenticados podem ver todos os usuários (necessário para o app funcionar)
CREATE POLICY "Authenticated users can view all" ON public_users
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Usuário pode atualizar apenas seu próprio perfil
CREATE POLICY "Users can update own profile" ON public_users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- INSERT permitido para novos usuários
CREATE POLICY "Allow insert for new users" ON public_users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Service role (backend) pode tudo
CREATE POLICY "Service role full access" ON public_users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- DELETE apenas para service role (admin deleta pelo backend)
CREATE POLICY "Service role can delete" ON public_users
    FOR DELETE
    USING (auth.jwt() ->> 'role' = 'service_role');

-- NOTA: A proteção de cargo/status é feita pelo TRIGGER, não pela policy
-- O trigger force_safe_user_defaults já impede que usuários definam seu próprio cargo
