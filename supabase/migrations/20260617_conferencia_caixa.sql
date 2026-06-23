-- ============================================================
-- MÓDULO: CONFERÊNCIA DE CAIXA
-- Data: 2026-06-17
-- ============================================================

-- 1. Colunas na tabela VENDAS para controlar o status de conferência
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_status TEXT;
-- Valores: NULL (não se aplica), 'aguardando', 'aprovado', 'devolvido'

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_at TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_por TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_por_id TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_observacao TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conferencia_caixa_pagamentos JSONB;
-- Armazena os pagamentos confirmados/alterados pelo gerente na conferência

-- 2. Flag do módulo em organization_settings
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS conferencia_caixa_enabled BOOLEAN DEFAULT false;

-- 3. Índice para consulta rápida de vendas aguardando conferência
CREATE INDEX IF NOT EXISTS idx_vendas_conferencia_caixa_status
  ON vendas (conferencia_caixa_status)
  WHERE conferencia_caixa_status IS NOT NULL;

-- 4. RLS já está habilitada na tabela vendas (existente)
-- Nenhuma alteração necessária nas policies existentes
