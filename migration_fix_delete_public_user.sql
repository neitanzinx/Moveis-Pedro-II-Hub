-- =============================================================
-- Fix: DELETE em public_users retornando 500
-- Problema: FKs sem ON DELETE SET NULL bloqueiam a deleção, 
--           e o trigger auto_delete_user_from_auth pode falhar.
-- =============================================================

-- 1. Corrigir FKs que referenciam public_users sem ON DELETE SET NULL
--    PostgreSQL não permite ALTER COLUMN para FKs; é necessário 
--    dropar e recriar com a opção correta.

-- clientes.created_by
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'created_by'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_created_by_fkey;
    ALTER TABLE clientes ADD CONSTRAINT clientes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK clientes.created_by: coluna inexistente ou tipo diferente de uuid';
  END IF;
END;
$$;

-- vendas.responsavel_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendas'
      AND column_name = 'responsavel_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_responsavel_id_fkey;
    ALTER TABLE vendas ADD CONSTRAINT vendas_responsavel_id_fkey
      FOREIGN KEY (responsavel_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK vendas.responsavel_id: coluna inexistente ou tipo diferente de uuid';
  END IF;
END;
$$;

-- audit_logs.user_id (caso a tabela use schema.sql com FK para public_users)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK audit_logs.user_id: coluna inexistente ou tipo diferente de uuid';
  END IF;
END;
$$;

-- mensagens_chat.destinatario_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mensagens_chat'
      AND column_name = 'destinatario_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE mensagens_chat DROP CONSTRAINT IF EXISTS mensagens_chat_destinatario_id_fkey;
    ALTER TABLE mensagens_chat ADD CONSTRAINT mensagens_chat_destinatario_id_fkey
      FOREIGN KEY (destinatario_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK mensagens_chat.destinatario_id: coluna inexistente ou tipo diferente de uuid';
  END IF;
END;
$$;

-- mensagens_chat.remetente_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mensagens_chat'
      AND column_name = 'remetente_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE mensagens_chat DROP CONSTRAINT IF EXISTS mensagens_chat_remetente_id_fkey;
    ALTER TABLE mensagens_chat ADD CONSTRAINT mensagens_chat_remetente_id_fkey
      FOREIGN KEY (remetente_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK mensagens_chat.remetente_id: coluna inexistente ou tipo diferente de uuid';
  END IF;
END;
$$;

-- 2. Tornar o trigger auto_delete_user_from_auth mais resiliente
--    Para que falha em auth.users não cancele o DELETE em public_users
CREATE OR REPLACE FUNCTION auto_delete_user_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Tentar deletar do Auth; ignorar se não existir ou falhar
  BEGIN
    DELETE FROM auth.users WHERE id = OLD.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Registrar mas não cancelar o DELETE em public_users
      RAISE WARNING 'Não foi possível deletar auth.users para id=%: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

-- Recriar o trigger caso não exista
DROP TRIGGER IF EXISTS trigger_delete_user_from_auth ON public_users;
CREATE TRIGGER trigger_delete_user_from_auth
  BEFORE DELETE ON public_users
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_user_from_auth();

-- 3. (Caso a tabela audit_logs use a versão antiga com coluna 'acao'/'tabela')
--    Adicionar coluna created_at se não existir (para garantir compatibilidade)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'timestamp'
  ) THEN
    -- Tabela usa 'timestamp'; adicionar alias created_at
    ALTER TABLE audit_logs ADD COLUMN created_at timestamptz 
      GENERATED ALWAYS AS (timestamp) STORED;
  ELSE
    RAISE NOTICE 'Ignorando created_at gerado em audit_logs: coluna ja existe ou timestamp nao existe';
  END IF;
END;
$$;
