-- ============================================================================
-- FIX: Criar RPC para resolver matrícula/email para login de funcionários
-- ============================================================================
-- PROBLEMA: O login de funcionários (LoginFuncionario.jsx) fazia uma query 
-- anônima na tabela public_users para buscar o perfil pela matrícula ou email
-- ANTES de autenticar via Supabase Auth. Com RLS multi-tenant ativado, essa
-- query anônima é bloqueada pela policy public_users_isolated.
--
-- SOLUÇÃO: Criar uma função SECURITY DEFINER que resolve matrícula/email
-- para o email correspondente, bypassing RLS. O frontend usa essa RPC
-- para obter o email e então autentica via signInWithPassword.
-- ============================================================================

-- 1. Criar a função RPC
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identificacao text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_identificacao ILIKE '%@%' THEN
    -- Identificação é um email: verificar se existe e está ativo
    SELECT email INTO v_email
    FROM public_users
    WHERE email = lower(p_identificacao) AND ativo = true
    LIMIT 1;
  ELSE
    -- Identificação é uma matrícula: resolver para email
    SELECT email INTO v_email
    FROM public_users
    WHERE matricula = upper(p_identificacao) AND ativo = true
    LIMIT 1;
  END IF;
  
  RETURN v_email;
END;
$$;

-- 2. Permitir que qualquer role (inclusive anon) chame essa função
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- 3. Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';
