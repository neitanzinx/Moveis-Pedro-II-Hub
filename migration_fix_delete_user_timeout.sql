-- =============================================================
-- Fix: DELETE em public_users causa statement timeout (código 57014)
-- Causa: trigger auto_delete_user_from_auth tenta deletar de
--        auth.users de forma síncrona, travando a query.
-- Solução: remover o trigger + corrigir FKs sem ON DELETE SET NULL
-- =============================================================

-- 1. Remover o trigger e a função que causam o timeout
DROP TRIGGER IF EXISTS trigger_delete_user_from_auth ON public_users;
DROP FUNCTION IF EXISTS auto_delete_user_from_auth();

-- Nota: o registro em auth.users ficará como órfão, mas é inofensivo.
--       Para limpar auth.users use o Admin API ou o painel do Supabase.

-- =============================================================
-- 2. Corrigir FKs sem ON DELETE SET NULL (tabelas do schema.sql)
-- =============================================================

-- clientes.created_by (only if column is uuid type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = 'created_by'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_created_by_fkey;
    ALTER TABLE clientes ADD CONSTRAINT clientes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK clientes.created_by: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- vendas.responsavel_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'responsavel_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_responsavel_id_fkey;
    ALTER TABLE vendas ADD CONSTRAINT vendas_responsavel_id_fkey
      FOREIGN KEY (responsavel_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK vendas.responsavel_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- audit_logs.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
    ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK audit_logs.user_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- mensagens_chat.destinatario_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mensagens_chat' AND column_name = 'destinatario_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE mensagens_chat DROP CONSTRAINT IF EXISTS mensagens_chat_destinatario_id_fkey;
    ALTER TABLE mensagens_chat ADD CONSTRAINT mensagens_chat_destinatario_id_fkey
      FOREIGN KEY (destinatario_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK mensagens_chat.destinatario_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- mensagens_chat.remetente_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mensagens_chat' AND column_name = 'remetente_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE mensagens_chat DROP CONSTRAINT IF EXISTS mensagens_chat_remetente_id_fkey;
    ALTER TABLE mensagens_chat ADD CONSTRAINT mensagens_chat_remetente_id_fkey
      FOREIGN KEY (remetente_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK mensagens_chat.remetente_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- =============================================================
-- 3. Corrigir FKs de tabelas de RH (migration_recursos_humanos)
-- =============================================================

-- colaboradores.user_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'colaboradores' AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_user_id_fkey;
    ALTER TABLE colaboradores ADD CONSTRAINT colaboradores_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK colaboradores.user_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- avaliacoes_desempenho.avaliador_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'avaliacoes_desempenho' AND column_name = 'avaliador_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE avaliacoes_desempenho DROP CONSTRAINT IF EXISTS avaliacoes_desempenho_avaliador_id_fkey;
    ALTER TABLE avaliacoes_desempenho ADD CONSTRAINT avaliacoes_desempenho_avaliador_id_fkey
      FOREIGN KEY (avaliador_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK avaliacoes_desempenho.avaliador_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- documentos_rh.uploaded_by
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documentos_rh' AND column_name = 'uploaded_by'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE documentos_rh DROP CONSTRAINT IF EXISTS documentos_rh_uploaded_by_fkey;
    ALTER TABLE documentos_rh ADD CONSTRAINT documentos_rh_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK documentos_rh.uploaded_by: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- licencas.aprovado_por
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'licencas' AND column_name = 'aprovado_por'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE licencas DROP CONSTRAINT IF EXISTS licencas_aprovado_por_fkey;
    ALTER TABLE licencas ADD CONSTRAINT licencas_aprovado_por_fkey
      FOREIGN KEY (aprovado_por) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK licencas.aprovado_por: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- ferias.aprovado_por
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ferias' AND column_name = 'aprovado_por'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE ferias DROP CONSTRAINT IF EXISTS ferias_aprovado_por_fkey;
    ALTER TABLE ferias ADD CONSTRAINT ferias_aprovado_por_fkey
      FOREIGN KEY (aprovado_por) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK ferias.aprovado_por: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- vagas.responsavel_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vagas' AND column_name = 'responsavel_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE vagas DROP CONSTRAINT IF EXISTS vagas_responsavel_id_fkey;
    ALTER TABLE vagas ADD CONSTRAINT vagas_responsavel_id_fkey
      FOREIGN KEY (responsavel_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK vagas.responsavel_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- candidatos.entrevistador_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'candidatos' AND column_name = 'entrevistador_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE candidatos DROP CONSTRAINT IF EXISTS candidatos_entrevistador_id_fkey;
    ALTER TABLE candidatos ADD CONSTRAINT candidatos_entrevistador_id_fkey
      FOREIGN KEY (entrevistador_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK candidatos.entrevistador_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;

-- assistencias_tecnicas.responsavel_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assistencias_tecnicas' AND column_name = 'responsavel_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE assistencias_tecnicas DROP CONSTRAINT IF EXISTS assistencias_tecnicas_responsavel_id_fkey;
    ALTER TABLE assistencias_tecnicas ADD CONSTRAINT assistencias_tecnicas_responsavel_id_fkey
      FOREIGN KEY (responsavel_id) REFERENCES public_users(id) ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'Ignorando FK assistencias_tecnicas.responsavel_id: coluna inexistente ou nao é uuid';
  END IF;
END;
$$;
