-- Migration: NFe Refactor (Focus NFe V2 + Multi-tenancy)
-- Description: Adds organization_id to vendas, cest to produtos, and creates organization_nfe_configs.

-- 1. Add organization_id to vendas if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendas' AND column_name = 'organization_id') THEN
        ALTER TABLE public.vendas ADD COLUMN organization_id uuid;
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_vendas_organization_id ON public.vendas(organization_id);
    END IF;
END $$;

-- 2. Add cest to produtos if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'cest') THEN
        ALTER TABLE public.produtos ADD COLUMN cest text;
    END IF;
END $$;

-- 3. Create organization_nfe_configs table
CREATE TABLE IF NOT EXISTS public.organization_nfe_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    ambiente text NOT NULL CHECK (ambiente IN ('homologacao', 'producao')),
    focus_token text NOT NULL,
    natureza_operacao_padrao text DEFAULT 'Venda',
    certificado_senha text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT organization_nfe_configs_org_env_key UNIQUE (organization_id, ambiente)
);

-- 4. Enable RLS
ALTER TABLE public.organization_nfe_configs ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- Service Role has full access
CREATE POLICY "Service Role Full Access" 
    ON public.organization_nfe_configs
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- Admin access (Placeholder: Adjust based on actual auth schema)
-- Assuming authenticated users with 'admin' role can manage configs
CREATE POLICY "Admins can manage nfe configs"
    ON public.organization_nfe_configs
    FOR ALL
    TO authenticated
    USING (
         -- Placeholder logic: assumes a function or claim exists. 
         -- For now, relying on service_role for critical ops prevents leaking credentials.
         -- If you have an 'organizations' table and 'members' table, uncomment/adapt below:
         -- organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
         false
    );

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    return new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handle_updated_at ON public.organization_nfe_configs;
CREATE TRIGGER handle_updated_at 
    BEFORE UPDATE ON public.organization_nfe_configs 
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 7. Cleanup old table
DROP TABLE IF EXISTS public.nfe_config;
