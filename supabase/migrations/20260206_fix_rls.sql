-- Migration: fix_rls_public_users
-- Execute this migration in your Supabase SQL Editor

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public_users ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public_users;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public_users;
DROP POLICY IF EXISTS "Users can update own profile." ON public_users;

-- 1. Política de Leitura: Usuários autenticados podem ver TODOS os perfis (necessário para listar colegas, etc)
-- Se preferir restrito: auth.uid() = id
CREATE POLICY "Allow read access for authenticated users" ON public_users
FOR SELECT TO authenticated USING (true);

-- 2. Política de Update Admin (Administradores podem editar tudo -> Gerido via Service Role no backend, mas bom ter no DB se usar Client)
-- Para segurança, geralmente bloqueamos updates diretos do cliente, exceto campos específicos.
-- Vamos permitir que o próprio usuário edite campos básicos (opcional) ou manter fechado.
-- Neste caso, como usamos Edge Functions com Service Role, a RLS não afeta o Admin.
-- Mas afeta a leitura do "Primeiro Acesso" no Login.

-- Garantir que a leitura do próprio usuário funcione (coberta pela regra 1 acima)
