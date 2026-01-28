-- Migration: Create whatsapp_bot_settings table for AI agent configuration
-- Date: 2026-01-04

CREATE TABLE IF NOT EXISTS public.whatsapp_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_bot_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings
CREATE POLICY "authenticated_select_whatsapp_settings" ON public.whatsapp_bot_settings
    FOR SELECT TO authenticated USING (true);

-- Allow admins to update settings
CREATE POLICY "admin_all_whatsapp_settings" ON public.whatsapp_bot_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.whatsapp_bot_settings (key, value) VALUES
    ('ai_enabled', 'true'),
    ('ai_model', '"gemini-2.0-flash"'),
    ('ai_instructions', '"Você é um assistente virtual da Móveis Pedro II. Responda de forma educada e profissional sobre entregas, montagens e pedidos. Seja conciso e objetivo."'),
    ('welcome_message', '"Olá! Sou o assistente virtual da Móveis Pedro II. Como posso ajudar?"')
ON CONFLICT (key) DO NOTHING;
