-- Migration: Row Level Security (RLS) para tabelas principais
-- Execute no Supabase Dashboard > SQL Editor

-- NOTA: Algumas tabelas usam bigint como ID, não UUID.
-- Por isso usamos subqueries para verificar permissões.

-- ============================================
-- VENDAS - Baseado no cargo do usuário
-- ============================================
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendedor vê próprias vendas" ON vendas;
DROP POLICY IF EXISTS "Admin vê todas vendas" ON vendas;
DROP POLICY IF EXISTS "Service role bypass vendas" ON vendas;

-- Qualquer usuário aprovado pode ver vendas (por enquanto)
-- TODO: Ajustar quando tiver campo user_id UUID na tabela vendas
CREATE POLICY "Usuarios aprovados veem vendas" ON vendas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND status_aprovacao = 'Aprovado'
        )
    );

-- Cargos específicos podem editar
CREATE POLICY "Cargos especificos editam vendas" ON vendas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo IN ('Administrador', 'Gerente', 'Vendedor', 'Financeiro')
            AND status_aprovacao = 'Aprovado'
        )
    );

-- Service role (backend) pode tudo
CREATE POLICY "Service role bypass vendas" ON vendas
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- CLIENTES - Todos aprovados podem ver
-- ============================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários aprovados veem clientes" ON clientes;
DROP POLICY IF EXISTS "Cargos específicos editam clientes" ON clientes;
DROP POLICY IF EXISTS "Service role bypass clientes" ON clientes;

CREATE POLICY "Usuarios aprovados veem clientes" ON clientes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Cargos especificos editam clientes" ON clientes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo IN ('Administrador', 'Gerente', 'Vendedor', 'Logística')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Service role bypass clientes" ON clientes
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- ENTREGAS - Cargos de logística
-- ============================================
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logística vê entregas" ON entregas;
DROP POLICY IF EXISTS "Service role bypass entregas" ON entregas;

CREATE POLICY "Logistica ve entregas" ON entregas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Logistica edita entregas" ON entregas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo IN ('Administrador', 'Gerente', 'Logística', 'Estoque')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Service role bypass entregas" ON entregas
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- MONTAGENS - Todos aprovados veem
-- ============================================
ALTER TABLE montagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Montador vê próprias montagens" ON montagens;
DROP POLICY IF EXISTS "Admin vê todas montagens" ON montagens;
DROP POLICY IF EXISTS "Service role bypass montagens" ON montagens;

CREATE POLICY "Usuarios veem montagens" ON montagens
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Agendamento edita montagens" ON montagens
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo IN ('Administrador', 'Gerente', 'Agendamento', 'Logística')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Service role bypass montagens" ON montagens
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- PRODUTOS - Todos veem
-- ============================================
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos veem produtos" ON produtos;
DROP POLICY IF EXISTS "Estoque edita produtos" ON produtos;
DROP POLICY IF EXISTS "Service role bypass produtos" ON produtos;

CREATE POLICY "Todos veem produtos" ON produtos
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Estoque edita produtos" ON produtos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public_users 
            WHERE id = auth.uid() 
            AND cargo IN ('Administrador', 'Gerente', 'Estoque')
            AND status_aprovacao = 'Aprovado'
        )
    );

CREATE POLICY "Service role bypass produtos" ON produtos
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- NOTAS: 
-- 1. Execute este SQL no Supabase Dashboard
-- 2. Todos usuários aprovados podem VER dados
-- 3. Edição é restrita por cargo
-- 4. Service role (bot WhatsApp) pode tudo
-- ============================================
