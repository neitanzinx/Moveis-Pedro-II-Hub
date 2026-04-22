ALTER TABLE fornecedores
ADD COLUMN IF NOT EXISTS markup_padrao_multiplicador numeric(10,4),
ADD COLUMN IF NOT EXISTS markup_padrao_percentual numeric(10,2),
ADD COLUMN IF NOT EXISTS usar_markup_padrao boolean DEFAULT false;

ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS markup_multiplicador numeric(10,4),
ADD COLUMN IF NOT EXISTS markup_percentual numeric(10,2),
ADD COLUMN IF NOT EXISTS preco_final_sugerido numeric(10,2),
ADD COLUMN IF NOT EXISTS preco_final_manual numeric(10,2),
ADD COLUMN IF NOT EXISTS usar_markup_fornecedor boolean DEFAULT false;

ALTER TABLE compras_oc_itens
ADD COLUMN IF NOT EXISTS preco_custo_item numeric(10,2),
ADD COLUMN IF NOT EXISTS markup_multiplicador numeric(10,4),
ADD COLUMN IF NOT EXISTS markup_percentual numeric(10,2),
ADD COLUMN IF NOT EXISTS preco_final_sugerido numeric(10,2),
ADD COLUMN IF NOT EXISTS preco_final_manual numeric(10,2);
