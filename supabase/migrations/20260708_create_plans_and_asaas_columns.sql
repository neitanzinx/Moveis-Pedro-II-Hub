-- =====================================================
-- MIGRATION: Assinatura de Planos via Asaas
-- Data: 2026-07-08
-- =====================================================

-- 1. CRIAR TABELA DE PLANOS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.planos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  preco_mensal NUMERIC(10,2) NOT NULL,
  recursos JSONB NOT NULL DEFAULT '{}',  -- mesmas chaves usadas em modulos_ativos
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security para planos
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Permitir que usuários autenticados leiam os planos ativos
CREATE POLICY select_planos ON public.planos
  FOR SELECT TO authenticated
  USING (ativo = true);

-- 2. NOVOS CAMPOS NA TABELA DE ORGANIZAÇÕES
-- =====================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES public.planos(id),
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS status_assinatura TEXT DEFAULT 'sem_assinatura',
  ADD COLUMN IF NOT EXISTS proxima_cobranca DATE;

-- 3. TABELA DE IDEMPOTÊNCIA PARA WEBHOOK DO ASAAS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados não precisam acessar essa tabela de eventos
CREATE POLICY select_asaas_events ON public.asaas_webhook_events
  FOR SELECT TO authenticated
  USING (false);

-- 4. INSERIR PLANOS PADRÃO
-- =====================================================
INSERT INTO public.planos (nome, slug, preco_mensal, recursos)
VALUES 
  ('Plano Essencial', 'essencial', 99.90, '{"whatsapp": false, "fotos_entrega": false}'),
  ('Plano Profissional', 'profissional', 199.90, '{"whatsapp": true, "fotos_entrega": false}'),
  ('Plano Completo', 'completo', 299.90, '{"whatsapp": true, "fotos_entrega": true}')
ON CONFLICT (slug) DO UPDATE
SET nome = EXCLUDED.nome,
    preco_mensal = EXCLUDED.preco_mensal,
    recursos = EXCLUDED.recursos;

-- 5. ROTINA AGENDADA DE CARÊNCIA (pg_cron)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Agendar a rotina diária de carência para rodar 1x por dia às 03:00 AM (UTC)
SELECT cron.schedule(
  'bloqueio-planos-atrasados',
  '0 3 * * *',
  $$
  -- 1. Gravar log de alteração de auditoria
  INSERT INTO public.audit_logs (table_name, action, record_id, old_data, new_data)
  SELECT 
    'organizations',
    'block_unpaid_modules',
    o.id::text,
    json_build_object('modulos_ativos', os.modulos_ativos, 'status_assinatura', o.status_assinatura),
    json_build_object('modulos_ativos', '{}'::jsonb, 'status_assinatura', o.status_assinatura)
  FROM public.organizations o
  JOIN public.organization_settings os ON os.organization_id = o.id
  WHERE o.status_assinatura = 'atrasada'
    AND o.proxima_cobranca < CURRENT_DATE - INTERVAL '3 days'
    AND os.modulos_ativos != '{}'::jsonb;

  -- 2. Limpar os módulos da organização inadimplente
  UPDATE public.organization_settings
  SET modulos_ativos = '{}'::jsonb,
      updated_at = NOW()
  WHERE organization_id IN (
    SELECT id 
    FROM public.organizations 
    WHERE status_assinatura = 'atrasada' 
      AND proxima_cobranca < CURRENT_DATE - INTERVAL '3 days'
  );
  $$
);
