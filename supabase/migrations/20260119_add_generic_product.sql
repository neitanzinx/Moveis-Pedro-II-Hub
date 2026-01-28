-- Migration: Add Generic Product for Solicitação de Cadastro
-- Description: Creates a system product used for "Solicitação de Cadastro" feature
-- This product acts as a placeholder when salespeople need to add unlisted items to orders

-- Insert generic product if it doesn't exist
INSERT INTO produtos (
    nome,
    descricao,
    codigo_barras,
    preco_venda,
    preco_custo,
    quantidade_estoque,
    ativo,
    categoria
) 
SELECT 
    'Produto Genérico (Solicitação)',
    'Produto de sistema para cadastros sob demanda. NÃO EXCLUIR.',
    'PROD-GENERICO',
    0.00,
    0.00,
    999999,
    true,
    'Sistema'
WHERE NOT EXISTS (
    SELECT 1 FROM produtos WHERE codigo_barras = 'PROD-GENERICO'
);
