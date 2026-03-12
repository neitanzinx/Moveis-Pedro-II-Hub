-- Create table for configurable delivery deadlines
CREATE TABLE IF NOT EXISTS public.prazos_entrega (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identificador TEXT NOT NULL UNIQUE, -- 'pronta_entrega' or 'encomenda'
    titulo TEXT NOT NULL,
    quantidade_dias INTEGER NOT NULL,
    tipo_dias TEXT NOT NULL CHECK (tipo_dias IN ('corridos', 'uteis')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prazos_entrega ENABLE ROW LEVEL SECURITY;

-- Policies (template follow)
DROP POLICY IF EXISTS all_prazos_entrega ON public.prazos_entrega;
CREATE POLICY all_prazos_entrega ON public.prazos_entrega 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at_prazos ON public.prazos_entrega;
CREATE TRIGGER handle_updated_at_prazos
    BEFORE UPDATE ON public.prazos_entrega
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Seed data with current hardcoded defaults
INSERT INTO public.prazos_entrega (identificador, titulo, quantidade_dias, tipo_dias)
VALUES 
    ('pronta_entrega', 'Pronta Entrega', 15, 'uteis'),
    ('encomenda', 'Encomenda', 45, 'uteis')
ON CONFLICT (identificador) DO UPDATE SET
    quantidade_dias = EXCLUDED.quantidade_dias,
    tipo_dias = EXCLUDED.tipo_dias;
