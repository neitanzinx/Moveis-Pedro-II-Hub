-- Adicionar coluna para múltiplos CNPJs
ALTER TABLE fornecedores 
ADD COLUMN IF NOT EXISTS outros_cnpjs JSONB DEFAULT '[]'::jsonb;


-- Adicionar coluna 'ativo' (Correção de erro 400)
ALTER TABLE fornecedores
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Comentário para documentação
COMMENT ON COLUMN fornecedores.outros_cnpjs IS 'Lista de CNPJs adicionais do fornecedor';
COMMENT ON COLUMN fornecedores.ativo IS 'Indica se o fornecedor está ativo';

-- Adicionar coluna 'observacoes'
ALTER TABLE fornecedores
ADD COLUMN IF NOT EXISTS observacoes TEXT;
COMMENT ON COLUMN fornecedores.observacoes IS 'Observações gerais do fornecedor';
