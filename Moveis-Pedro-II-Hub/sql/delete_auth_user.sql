-- =============================================================
-- OPÇÃO 1: Função SQL para deletar usuário do Auth
-- Execute este SQL no Supabase SQL Editor
-- =============================================================

-- Esta função deleta um usuário do Supabase Auth
-- IMPORTANTE: Precisa executar como superuser/service_role
CREATE OR REPLACE FUNCTION delete_user_from_auth(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Deletar da tabela auth.users (isso deleta o usuário do Auth)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

-- Dar permissão para a função ser chamada
GRANT EXECUTE ON FUNCTION delete_user_from_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_from_auth(uuid) TO service_role;


-- =============================================================
-- OPÇÃO 2: Trigger automático (DELETE CASCADE)
-- Quando deletar da public_users, deleta automaticamente do Auth
-- =============================================================

CREATE OR REPLACE FUNCTION auto_delete_user_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Quando deletar da public_users, deleta também do Auth
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- Criar o trigger na tabela public_users
DROP TRIGGER IF EXISTS trigger_delete_user_from_auth ON public_users;

CREATE TRIGGER trigger_delete_user_from_auth
  BEFORE DELETE ON public_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_user_from_auth();


-- =============================================================
-- COMO USAR:
-- 
-- OPÇÃO 1 (Manual): 
--   SELECT delete_user_from_auth('uuid-do-usuario-aqui');
--
-- OPÇÃO 2 (Automático):
--   Basta deletar da tabela public_users que o Auth é deletado junto
--   DELETE FROM public_users WHERE id = 'uuid-do-usuario';
--
-- NOTA: O código da aplicação já usa a OPÇÃO 2 automaticamente
--       após executar este SQL no Supabase
-- =============================================================


-- Para deletar o usuário específico que está dando problema:
-- (substitua pelo email correto se necessário)
-- DELETE FROM public_users WHERE email = 'contato.natanrizzo@gmail.com';
-- ou
-- SELECT delete_user_from_auth((SELECT id FROM auth.users WHERE email = 'contato.natanrizzo@gmail.com'));
