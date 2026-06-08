-- ============================================================
-- Desconto Individual por Produto no PDV
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Novos campos na tabela lojas
ALTER TABLE lojas
  ADD COLUMN IF NOT EXISTS desconto_produto_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS desconto_produto_max_percent numeric(5,2) DEFAULT 0;

-- Remover a tabela se já existir para corrigir o tipo incompatível do produto_id (uuid)
DROP TABLE IF EXISTS desconto_produto_excecoes CASCADE;

-- 2. Nova tabela de exceções
CREATE TABLE desconto_produto_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid REFERENCES lojas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES produtos(id) ON DELETE CASCADE,
  produto_nome text,          -- cache para exibição rápida
  categoria text,             -- quando a exceção é por categoria
  created_at timestamptz DEFAULT now()
);

-- Constraint: deve ter produto_id OU categoria (não ambos vazios)
ALTER TABLE desconto_produto_excecoes
  ADD CONSTRAINT excecao_produto_ou_categoria
  CHECK (produto_id IS NOT NULL OR (categoria IS NOT NULL AND categoria <> ''));

ALTER TABLE desconto_produto_excecoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_desconto_produto_excecoes ON desconto_produto_excecoes;
CREATE POLICY all_desconto_produto_excecoes ON desconto_produto_excecoes
FOR ALL TO authenticated USING (true) WITH CHECK (true);
