-- Adicionar coluna cnpj na tabela lojas
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cnpj text;
