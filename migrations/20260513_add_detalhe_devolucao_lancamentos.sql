-- Adiciona campo de detalhe de devolução na tabela de lançamentos financeiros
-- Usado no fluxo de criação de lançamento a partir de OC no setor de compras,
-- onde o usuário deve anexar o comprovante de devolução do fabricante antes
-- de enviar o lançamento para aprovação do setor financeiro.

ALTER TABLE lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS detalhe_devolucao text;
