-- Adicionando campos promocionais faltantes na tabela pedidos_compra
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS tipo_preco TEXT DEFAULT 'tabela';
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS preco_tabela_total NUMERIC(10,2);
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS economia_total NUMERIC(10,2) DEFAULT 0;
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS promocao_inicio DATE;
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS promocao_fim DATE;
ALTER TABLE pedidos_compra ADD COLUMN IF NOT EXISTS promocao_observacao TEXT;
