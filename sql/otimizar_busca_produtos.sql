-- Criar o índice na tabela de produtos para acelerar o RLS e a busca
CREATE INDEX IF NOT EXISTS idx_produtos_org_id ON public.produtos (organization_id);
