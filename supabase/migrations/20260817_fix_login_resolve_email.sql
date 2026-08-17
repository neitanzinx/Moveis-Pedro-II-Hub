-- ============================================================================
-- FIX: Aprimorar RPC resolve_login_email para login resiliente
-- ============================================================================
-- PROBLEMAS CORRIGIDOS:
-- 1. Espaços em branco acidentais no início/fim da identificação
-- 2. Diferença de maiúsculas/minúsculas no email e na matrícula
-- 3. Usuários onde a coluna 'ativo' é NULL (tratar como ativo)
-- 4. Suporte a variações de matrícula (com ou sem hífen)
-- 5. Fallback para auth.users e retorno direto do email se for formato @ válido
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identificacao text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_input text;
BEGIN
  -- 1. Limpar espaços nas pontas
  v_input := trim(p_identificacao);
  
  IF v_input IS NULL OR v_input = '' THEN
    RETURN NULL;
  END IF;

  IF v_input ILIKE '%@%' THEN
    -- 2. Identificação é um email: verificar na public_users (case-insensitive e tolerante a ativo NULL)
    SELECT email INTO v_email
    FROM public.public_users
    WHERE lower(trim(email)) = lower(v_input) 
      AND (ativo IS TRUE OR ativo IS NULL)
    LIMIT 1;
    
    -- Se não achou na public_users mas é formato de email, verifica no auth.users (caso admin/owner ou perfil pendente)
    IF v_email IS NULL THEN
      SELECT email INTO v_email
      FROM auth.users
      WHERE lower(trim(email)) = lower(v_input)
      LIMIT 1;
    END IF;

    -- Se ainda for nulo, retorna o próprio email formatado para deixar o Supabase Auth validar a autenticação
    IF v_email IS NULL THEN
      v_email := lower(v_input);
    END IF;
  ELSE
    -- 3. Identificação é uma matrícula: resolver para email
    SELECT email INTO v_email
    FROM public.public_users
    WHERE (
      upper(trim(matricula)) = upper(v_input)
      OR replace(upper(trim(matricula)), '-', '') = replace(upper(v_input), '-', '')
      OR matricula ILIKE v_input
    ) AND (ativo IS TRUE OR ativo IS NULL)
    LIMIT 1;
  END IF;
  
  RETURN v_email;
END;
$$;

-- Permitir que roles anon e authenticated chamem a função
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon, authenticated;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
