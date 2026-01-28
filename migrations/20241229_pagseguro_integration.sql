-- PagSeguro Integration: Database Schema Changes
-- Run this in Supabase SQL Editor

-- 1. Add payment tracking columns to vendas table
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS link_pagamento TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS checkout_id TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'PENDENTE';
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- 2. Create configuracoes_sistema table for storing credentials securely
CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT UNIQUE NOT NULL,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Insert default PagSeguro configuration placeholders
INSERT INTO configuracoes_sistema (chave, valor, descricao) VALUES 
  ('pagseguro_token', '', 'Token de autenticação da API PagSeguro'),
  ('pagseguro_email', '', 'Email da conta PagSeguro'),
  ('pagseguro_ambiente', 'sandbox', 'Ambiente: sandbox ou production')
ON CONFLICT (chave) DO NOTHING;

-- 4. Enable RLS on configuracoes_sistema (only admins can access)
ALTER TABLE configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- Admin-only policy for configuracoes_sistema
CREATE POLICY "Admins can manage system config" ON configuracoes_sistema
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public_users 
      WHERE id = auth.uid() 
      AND cargo = 'Administrador'
    )
  );

-- 5. Create index for faster checkout_id lookups (webhook)
CREATE INDEX IF NOT EXISTS idx_vendas_checkout_id ON vendas(checkout_id);
CREATE INDEX IF NOT EXISTS idx_vendas_status_pagamento ON vendas(status_pagamento);
