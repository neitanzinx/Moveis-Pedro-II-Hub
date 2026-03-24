-- Fix: RLS policies for compras_recebimentos_historico and compras_recebimentos_itens
-- Problem: original policy used tenant_id = auth.uid()::uuid which is always false
-- (tenant_id is the org UUID, not the user's UUID)
-- Solution: use same pattern as other tables (public_users check)

-- ============================================================
-- compras_recebimentos_historico
-- ============================================================
ALTER TABLE compras_recebimentos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_recebimentos_tenant ON compras_recebimentos_historico;
DROP POLICY IF EXISTS "rls_recebimentos_tenant" ON compras_recebimentos_historico;
DROP POLICY IF EXISTS "Service role bypass recebimentos" ON compras_recebimentos_historico;
DROP POLICY IF EXISTS "Compras recebimentos select" ON compras_recebimentos_historico;
DROP POLICY IF EXISTS "Compras recebimentos all" ON compras_recebimentos_historico;

-- Usuários aprovados podem SELECT
CREATE POLICY "Compras recebimentos select"
ON compras_recebimentos_historico
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND status_aprovacao = 'Aprovado'
    )
);

-- Cargos com acesso a compras podem INSERT/UPDATE/DELETE
CREATE POLICY "Compras recebimentos all"
ON compras_recebimentos_historico
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Comprador', 'Estoque')
        AND status_aprovacao = 'Aprovado'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Comprador', 'Estoque')
        AND status_aprovacao = 'Aprovado'
    )
);

-- Service role bypass
CREATE POLICY "Service role bypass recebimentos"
ON compras_recebimentos_historico
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- compras_recebimentos_itens
-- ============================================================
ALTER TABLE compras_recebimentos_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_recebimentos_itens_tenant ON compras_recebimentos_itens;
DROP POLICY IF EXISTS "rls_recebimentos_itens_tenant" ON compras_recebimentos_itens;
DROP POLICY IF EXISTS "Service role bypass recebimentos itens" ON compras_recebimentos_itens;
DROP POLICY IF EXISTS "Compras recebimentos itens select" ON compras_recebimentos_itens;
DROP POLICY IF EXISTS "Compras recebimentos itens all" ON compras_recebimentos_itens;

-- Usuários aprovados podem SELECT
CREATE POLICY "Compras recebimentos itens select"
ON compras_recebimentos_itens
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND status_aprovacao = 'Aprovado'
    )
);

-- Cargos com acesso a compras podem INSERT/UPDATE/DELETE
CREATE POLICY "Compras recebimentos itens all"
ON compras_recebimentos_itens
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Comprador', 'Estoque')
        AND status_aprovacao = 'Aprovado'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public_users
        WHERE id = auth.uid()
        AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Comprador', 'Estoque')
        AND status_aprovacao = 'Aprovado'
    )
);

-- Service role bypass
CREATE POLICY "Service role bypass recebimentos itens"
ON compras_recebimentos_itens
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
