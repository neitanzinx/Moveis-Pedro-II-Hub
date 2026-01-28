-- Migration: Create Stone payment tables
-- Date: 2026-01-04

-- Configurações da Stone (uma por ambiente)
CREATE TABLE IF NOT EXISTS public.stone_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment TEXT NOT NULL DEFAULT 'sandbox', -- 'sandbox' | 'production'
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    account_id TEXT,
    webhook_secret TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(environment)
);

-- Links de pagamento gerados
CREATE TABLE IF NOT EXISTS public.payment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stone_id TEXT UNIQUE, -- ID retornado pela Stone
    venda_id UUID REFERENCES vendas(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- Em centavos
    description TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_document TEXT,
    payment_url TEXT,
    qr_code TEXT,
    status TEXT DEFAULT 'pending', -- pending | paid | expired | cancelled
    payment_method TEXT, -- pix | credit_card | boleto
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log de webhooks recebidos
CREATE TABLE IF NOT EXISTS public.stone_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    stone_event_id TEXT,
    payment_link_id UUID REFERENCES payment_links(id) ON DELETE SET NULL,
    payload JSONB,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    received_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payment_links_stone_id ON public.payment_links(stone_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_venda_id ON public.payment_links(venda_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(status);
CREATE INDEX IF NOT EXISTS idx_stone_webhooks_event_type ON public.stone_webhooks(event_type);

-- Enable RLS
ALTER TABLE public.stone_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stone_webhooks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para stone_config (apenas admins)
CREATE POLICY "authenticated_select_stone_config" ON public.stone_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_all_stone_config" ON public.stone_config
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas RLS para payment_links
CREATE POLICY "authenticated_select_payment_links" ON public.payment_links
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_all_payment_links" ON public.payment_links
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Políticas RLS para stone_webhooks
CREATE POLICY "authenticated_select_stone_webhooks" ON public.stone_webhooks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "service_role_all_stone_webhooks" ON public.stone_webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_stone_config_updated_at ON public.stone_config;
CREATE TRIGGER update_stone_config_updated_at
    BEFORE UPDATE ON public.stone_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_links_updated_at ON public.payment_links;
CREATE TRIGGER update_payment_links_updated_at
    BEFORE UPDATE ON public.payment_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
