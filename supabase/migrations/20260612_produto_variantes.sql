-- =====================================================
-- Migration: Produto Base + Variantes
-- Criada em: 2026-06-12
-- 
-- Cria tabelas de suporte para o padrão Produto Base + Variantes:
-- cores, tecidos, produto_variantes, estoque
-- =====================================================

-- 1. Catálogo de Cores
create table if not exists cores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  hex text,
  organization_id uuid references organizations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (nome, organization_id)
);

ALTER TABLE cores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_cores ON cores;
CREATE POLICY all_cores ON cores 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Catálogo de Tecidos
create table if not exists tecidos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  organization_id uuid references organizations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (nome, organization_id)
);

ALTER TABLE tecidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_tecidos ON tecidos;
CREATE POLICY all_tecidos ON tecidos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Variantes de Produto (cor x tecido)
create table if not exists produto_variantes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produtos(id) on delete cascade,
  cor_id uuid references cores(id),
  tecido_id uuid references tecidos(id),
  sku text not null,
  preco_venda numeric(10,2),
  ativo boolean default true,
  organization_id uuid references organizations(id) on delete cascade,
  created_at timestamptz default now(),
  unique (sku, organization_id)
);

ALTER TABLE produto_variantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_produto_variantes ON produto_variantes;
CREATE POLICY all_produto_variantes ON produto_variantes 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Estoque por Variante + Loja
create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  variante_id uuid references produto_variantes(id) on delete cascade,
  loja_id uuid references lojas(id) on delete cascade,
  quantidade integer default 0,
  organization_id uuid references organizations(id) on delete cascade,
  unique (variante_id, loja_id)
);

ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS all_estoque ON estoque;
CREATE POLICY all_estoque ON estoque 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Índices para performance
create index if not exists idx_produto_variantes_produto_id on produto_variantes (produto_id);
create index if not exists idx_produto_variantes_cor_id on produto_variantes (cor_id);
create index if not exists idx_produto_variantes_tecido_id on produto_variantes (tecido_id);
create index if not exists idx_estoque_variante_id on estoque (variante_id);
create index if not exists idx_estoque_loja_id on estoque (loja_id);

-- 6. Unique constraint na tabela produtos para suportar upsert por produto base
-- Necessária para que o ImportProdutosModal possa fazer upsert com onConflict
-- Usa DO $$ para não falhar se a constraint já existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'produtos_modelo_referencia_organization_id_key'
  ) THEN
    ALTER TABLE produtos ADD CONSTRAINT produtos_modelo_referencia_organization_id_key 
      UNIQUE (modelo_referencia, organization_id);
  END IF;
END $$;
