-- Migration: fix_delete_user_trigger
-- Objetivo: Evitar deadlock e loop de trigger infinito ao deletar usuários,
-- e expor a função de deleção segura via RPC.

-- 1. Recriar a função de trigger com proteção EXISTS para evitar loop recursivo
CREATE OR REPLACE FUNCTION auto_delete_user_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Quando deletar da public_users, deleta também do Auth apenas se a exclusão
  -- começou diretamente na public_users (pg_trigger_depth() = 1).
  -- Isso evita o loop infinito quando a deleção vem do CASCADE da auth.users.
  IF pg_trigger_depth() = 1 THEN
    DELETE FROM auth.users WHERE id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;

-- 2. Garantir que o trigger está associado corretamente à tabela public_users
DROP TRIGGER IF EXISTS trigger_delete_user_from_auth ON public_users;

CREATE TRIGGER trigger_delete_user_from_auth
  BEFORE DELETE ON public_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_user_from_auth();

-- 3. Garantir a função SQL RPC para deleção de usuário pelo administrador
CREATE OR REPLACE FUNCTION delete_user_from_auth(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- 1. Desvincular ou deletar registros em tabelas que possuem foreign keys sem CASCADE
  BEGIN
    UPDATE public.colaboradores SET user_id = NULL WHERE user_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.clientes SET created_by = NULL WHERE created_by = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.vendas SET responsavel_id = NULL WHERE responsavel_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notificacoes WHERE destinatario_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.mensagens_chat SET remetente_id = NULL WHERE remetente_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.assistencias_tecnicas SET responsavel_id = NULL WHERE responsavel_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.avaliacoes_desempenho SET avaliador_id = NULL WHERE avaliador_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.documentos_rh SET uploaded_by = NULL WHERE uploaded_by = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.licencas SET aprovado_por = NULL WHERE aprovado_por = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.ferias SET aprovado_por = NULL WHERE aprovado_por = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.vagas SET responsavel_id = NULL WHERE responsavel_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.candidatos SET entrevistador_id = NULL WHERE entrevistador_id = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.role_permissions SET updated_by = NULL WHERE updated_by = delete_user_from_auth.user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2. Deletar da tabela auth.users (isso deleta do Auth e propaga via cascade para public_users)
  DELETE FROM auth.users WHERE id = delete_user_from_auth.user_id;
END;
$$;

-- 4. Garantir permissões de execução para a função RPC
GRANT EXECUTE ON FUNCTION delete_user_from_auth(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_from_auth(uuid) TO service_role;

-- 5. Recarregar o cache de schema do PostgREST
NOTIFY pgrst, reload schema;
