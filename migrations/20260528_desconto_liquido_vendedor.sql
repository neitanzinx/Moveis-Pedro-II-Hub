-- Adiciona coluna desconto_vendedor na tabela configuracao_taxa
-- Representa o percentual descontado do valor da venda para calcular
-- o valor líquido do vendedor, que é a base usada pela loja para
-- calcular a comissão manualmente.
--
-- Conceitos:
--   valor         = Taxa da Loja      (custo da loja, ex: taxa da maquininha)
--   acrescimo     = Acréscimo Cliente (valor extra cobrado do cliente no PDV)
--   desconto_vendedor = Desc. Líq. Vendedor (desconto na base de comissão do vendedor)
--
-- Exemplos:
--   Crédito 1x:  taxa_loja=3%, acrescimo_cliente=0%, desconto_vendedor=10%
--   Multicrédito: taxa_loja=10%, acrescimo_cliente=10%, desconto_vendedor=10%

ALTER TABLE configuracao_taxa
  ADD COLUMN IF NOT EXISTS desconto_vendedor numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN configuracao_taxa.desconto_vendedor IS
  'Percentual descontado do valor da venda para calcular o líquido do vendedor (base para comissão manual)';
