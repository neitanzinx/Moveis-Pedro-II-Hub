-- Migration: Vendedor edita apenas clientes que criou
-- Execute no Supabase Dashboard > SQL Editor

DROP POLICY IF EXISTS "Cargos especificos editam clientes" ON clientes;
DROP POLICY IF EXISTS "Cargos especificos criam clientes" ON clientes;
DROP POLICY IF EXISTS "Gerentes editam clientes" ON clientes;
DROP POLICY IF EXISTS "Vendedor edita proprios clientes" ON clientes;
DROP POLICY IF EXISTS "Gerentes excluem clientes" ON clientes;

CREATE POLICY "Cargos especificos criam clientes" ON clientes
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public_users
            WHERE id = auth.uid()
            AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Vendedor', 'Logística')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Gerentes editam clientes" ON clientes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public_users
            WHERE id = auth.uid()
            AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral', 'Logística')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Vendedor edita proprios clientes" ON clientes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public_users
            WHERE id = auth.uid()
            AND cargo = 'Vendedor'
            AND status_aprovacao = 'Aprovado'
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Gerentes excluem clientes" ON clientes
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public_users
            WHERE id = auth.uid()
            AND cargo IN ('Administrador', 'Gerente', 'Gerente Geral')
            AND status_aprovacao = 'Aprovado'
        )
    );
