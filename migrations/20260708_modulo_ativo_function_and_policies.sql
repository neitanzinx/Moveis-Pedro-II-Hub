-- =====================================================
-- MIGRATION: Função modulo_ativo() + RLS/Storage policies
-- para bloqueio de módulos WhatsApp e Fotos de Entrega
-- Data: 2026-07-08
-- =====================================================

-- =====================================================
-- 1. FUNÇÃO modulo_ativo(org_id, chave)
-- Retorna TRUE apenas se a chave existir no JSON E for
-- explicitamente true. Ausência = desativado (fail-safe).
-- Nunca retorna NULL.
-- =====================================================
CREATE OR REPLACE FUNCTION public.modulo_ativo(p_org_id uuid, p_chave text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_valor jsonb;
  v_modulos jsonb;
BEGIN
  -- Buscar o JSON completo de modulos_ativos da organização
  SELECT modulos_ativos INTO v_modulos
  FROM organization_settings
  WHERE organization_id = p_org_id;

  -- Se a organização não tem registro ou modulos_ativos é null → desativado
  IF v_modulos IS NULL THEN
    RETURN false;
  END IF;

  -- Se a chave não existe no JSON → desativado (fail-safe: ausente = bloqueado)
  IF NOT v_modulos ? p_chave THEN
    RETURN false;
  END IF;

  -- Pegar o valor da chave
  v_valor := v_modulos -> p_chave;

  -- Só retorna true se o valor for explicitamente true (boolean JSON)
  RETURN v_valor = 'true'::jsonb;
END;
$$;

COMMENT ON FUNCTION public.modulo_ativo(uuid, text) IS
  'Verifica se um módulo pago está ativo para a organização. '
  'Retorna false se a chave não existir (fail-safe: ausente = desativado). '
  'Usado em RLS policies e storage policies para bloqueio por plano.';

-- =====================================================
-- 2. ADICIONAR organization_id NA TABELA whatsapp_message_queue
-- Necessário para que a RLS consiga filtrar por organização.
-- Default para o tenant 01 (Móveis Pedro II) para dados existentes.
-- =====================================================
ALTER TABLE whatsapp_message_queue
ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES organizations(id)
  DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_org_id
  ON whatsapp_message_queue(organization_id);

-- =====================================================
-- 3. RLS POLICY PARA whatsapp_message_queue
-- Bloqueia INSERT se o módulo 'whatsapp' não estiver ativo.
-- Nota: O bot Node.js usa service_role key que IGNORA RLS.
-- Esta policy protege apenas inserções via client-side (anon/authenticated).
-- A checagem no bot (Camada 2) é indispensável.
-- =====================================================

-- Remover a policy permissiva existente
DROP POLICY IF EXISTS all_whatsapp_message_queue ON whatsapp_message_queue;

-- Policy de SELECT: usuários autenticados podem ler mensagens da sua org
CREATE POLICY whatsapp_queue_select ON whatsapp_message_queue
  FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy de INSERT: só se módulo whatsapp estiver ativo
CREATE POLICY whatsapp_queue_insert ON whatsapp_message_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND public.modulo_ativo(
      (SELECT organization_id FROM profiles WHERE id = auth.uid()),
      'whatsapp'
    )
  );

-- Policy de UPDATE: usuários autenticados da mesma org
CREATE POLICY whatsapp_queue_update ON whatsapp_message_queue
  FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy de DELETE: usuários autenticados da mesma org
CREATE POLICY whatsapp_queue_delete ON whatsapp_message_queue
  FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- =====================================================
-- 4. STORAGE POLICY PARA BUCKET 'comprovantes'
-- Bloqueia upload (INSERT) se o módulo 'fotos_entrega'
-- não estiver ativo para a organização do usuário.
-- =====================================================

-- Storage policies usam a tabela storage.objects
-- O bucket_id identifica qual bucket a policy se aplica

-- Policy: Permitir upload somente se módulo fotos_entrega estiver ativo
CREATE POLICY storage_comprovantes_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND public.modulo_ativo(
      (SELECT organization_id FROM profiles WHERE id = auth.uid()),
      'fotos_entrega'
    )
  );

-- Policy: Permitir leitura de comprovantes para usuários autenticados da org
-- (Manter acesso de leitura mesmo se módulo for desativado depois,
-- para que fotos antigas continuem visíveis)
CREATE POLICY storage_comprovantes_select
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes'
  );

-- =====================================================
-- 5. HELPER: Função para obter org_id do usuário atual
-- Útil para consultas no bot/edge functions
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;
