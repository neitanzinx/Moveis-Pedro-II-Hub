-- =====================================================
-- FIX: Criar tabelas e constraints para importação de produtos
-- Execute este SQL no Supabase SQL Editor
-- Data: 2026-06-27
-- NOTA: produtos.id é BIGINT, não UUID
-- =====================================================

-- 1. Catálogo de Cores
CREATE TABLE IF NOT EXISTS cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  hex text,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nome, organization_id)
);

ALTER TABLE cores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_cores ON cores;
CREATE POLICY all_cores ON cores 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Catálogo de Tecidos
CREATE TABLE IF NOT EXISTS tecidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (nome, organization_id)
);

ALTER TABLE tecidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_tecidos ON tecidos;
CREATE POLICY all_tecidos ON tecidos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Variantes de Produto (cor x tecido)
-- NOTA: produto_id é BIGINT porque produtos.id é BIGINT
CREATE TABLE IF NOT EXISTS produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id bigint REFERENCES produtos(id) ON DELETE CASCADE,
  cor_id uuid REFERENCES cores(id),
  tecido_id uuid REFERENCES tecidos(id),
  sku text NOT NULL,
  preco_venda numeric(10,2),
  ativo boolean DEFAULT true,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (sku, organization_id)
);

ALTER TABLE produto_variantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_produto_variantes ON produto_variantes;
CREATE POLICY all_produto_variantes ON produto_variantes 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Estoque por Variante + Loja
CREATE TABLE IF NOT EXISTS estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_id uuid REFERENCES produto_variantes(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE,
  quantidade integer DEFAULT 0,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (variante_id, loja_id)
);

ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_estoque ON estoque;
CREATE POLICY all_estoque ON estoque 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_produto_variantes_produto_id ON produto_variantes (produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_cor_id ON produto_variantes (cor_id);
CREATE INDEX IF NOT EXISTS idx_produto_variantes_tecido_id ON produto_variantes (tecido_id);
CREATE INDEX IF NOT EXISTS idx_estoque_variante_id ON estoque (variante_id);
CREATE INDEX IF NOT EXISTS idx_estoque_loja_id ON estoque (loja_id);

-- 6. Atualizar constraints na tabela produtos (Nova Abordagem: Produtos Individuais)
DO $$
BEGIN
  -- Remover a constraint antiga baseada em modelo_referencia (agora que cada cor é um produto independente)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'produtos_modelo_referencia_organization_id_key'
  ) THEN
    ALTER TABLE produtos DROP CONSTRAINT produtos_modelo_referencia_organization_id_key;
  END IF;

  -- Garantir constraint única por código de barras (SKU) por tenant
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'produtos_codigo_barras_organization_id_key'
  ) THEN
    ALTER TABLE produtos ADD CONSTRAINT produtos_codigo_barras_organization_id_key 
      UNIQUE (codigo_barras, organization_id);
  END IF;
END $$;

