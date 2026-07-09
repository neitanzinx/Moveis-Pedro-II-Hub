-- =====================================================
-- ROTEIRO DE TESTE SQL: Função modulo_ativo()
-- Banco de dados do MPII Hub (Supabase/PostgreSQL)
-- Data: 2026-07-08
-- =====================================================

BEGIN;

-- 1. Setup: Criar organização e configurações de teste
INSERT INTO organizations (id, name, slug, cnpj, is_active)
VALUES (
  '99999999-9999-9999-9999-999999999999'::uuid,
  'Organização de Teste Planos',
  'teste-planos',
  '00.000.000/0001-00',
  true
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO organization_settings (organization_id, modulos_ativos)
VALUES (
  '99999999-9999-9999-9999-999999999999'::uuid,
  '{"whatsapp": true, "fotos_entrega": false}'::jsonb
) ON CONFLICT (organization_id) DO UPDATE 
SET modulos_ativos = '{"whatsapp": true, "fotos_entrega": false}'::jsonb;

-- 2. Executar os testes de validação lógica
SELECT 
  -- Teste 1: WhatsApp deve estar ATIVO (true no JSON)
  public.modulo_ativo('99999999-9999-9999-9999-999999999999'::uuid, 'whatsapp') = true AS teste_whatsapp_ativo,
  
  -- Teste 2: Fotos de Entrega deve estar INATIVO (false no JSON)
  public.modulo_ativo('99999999-9999-9999-9999-999999999999'::uuid, 'fotos_entrega') = false AS teste_fotos_inativo,
  
  -- Teste 3: Módulo inexistente/ausente no JSON deve retornar FALSE (fail-safe)
  public.modulo_ativo('99999999-9999-9999-9999-999999999999'::uuid, 'modulo_inexistente') = false AS teste_modulo_ausente_false,
  
  -- Teste 4: Organização inexistente na tabela deve retornar FALSE (fail-safe)
  public.modulo_ativo('88888888-8888-8888-8888-888888888888'::uuid, 'whatsapp') = false AS teste_org_inexistente_false;

-- 3. Teardown: Reverter as alterações de teste para não poluir o banco
ROLLBACK;
