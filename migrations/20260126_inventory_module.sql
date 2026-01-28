        -- Create table for Master Products (Global catalog)
        CREATE TABLE IF NOT EXISTS produtos_mestre (
            gtin text PRIMARY KEY,
            nome text NOT NULL,
            marca text,
            ncm text,
            foto_url text,
            volumes_esperados integer DEFAULT 1,
            status text CHECK (status IN ('COMPLETO', 'REVISAO_PENDENTE')),
            created_at timestamptz DEFAULT now()
        );

        -- Enable RLS on produtos_mestre
        ALTER TABLE produtos_mestre ENABLE ROW LEVEL SECURITY;

        -- Policy for reading produtos_mestre: Authenticated users can read all
        DROP POLICY IF EXISTS "Authenticated users can read produtos_mestre" ON produtos_mestre;
        CREATE POLICY "Authenticated users can read produtos_mestre" 
        ON produtos_mestre FOR SELECT USING (auth.role() = 'authenticated');

        -- Policy for writing produtos_mestre: Authenticated users can insert/update (Refine if needed later)
        DROP POLICY IF EXISTS "Authenticated users can insert/update produtos_mestre" ON produtos_mestre;
        CREATE POLICY "Authenticated users can insert/update produtos_mestre" 
        ON produtos_mestre FOR ALL USING (auth.role() = 'authenticated');


        -- Create table for Store Inventory (Tenant specific)
        CREATE TABLE IF NOT EXISTS estoque_loja (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            gtin text REFERENCES produtos_mestre(gtin) ON DELETE CASCADE,
            tenant_id text, -- Matches 'loja' from public_users or logic
            quantidade integer DEFAULT 0,
            preco_custo numeric(10,2),
            preco_venda numeric(10,2),
            volumes_recebidos jsonb DEFAULT '[]'::jsonb, -- Array to track received volumes for kits, e.g. [1, 2]
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );

        -- Enable RLS on estoque_loja
        ALTER TABLE estoque_loja ENABLE ROW LEVEL SECURITY;

        -- Policy for estoque_loja: Users can only access their store's inventory
        -- Assuming 'loja' column in public_users table defines the tenant
        DROP POLICY IF EXISTS "Users can access their store inventory" ON estoque_loja;
        CREATE POLICY "Users can access their store inventory"
        ON estoque_loja
        FOR ALL
        USING (
            (SELECT cargo FROM public_users WHERE id = auth.uid()) ILIKE 'Administrador'
            OR
            tenant_id = COALESCE(NULLIF((SELECT loja FROM public_users WHERE id = auth.uid()), ''), 'CD')
        );

        -- Index for performance
        DROP INDEX IF EXISTS idx_estoque_loja_gtin;
        CREATE INDEX idx_estoque_loja_gtin ON estoque_loja(gtin);
        DROP INDEX IF EXISTS idx_estoque_loja_tenant;
        CREATE INDEX idx_estoque_loja_tenant ON estoque_loja(tenant_id);
