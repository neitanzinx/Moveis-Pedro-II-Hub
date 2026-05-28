-- Migration: Margem Negociável por Loja + Metadados de Desconto na Venda
-- Data: 2026-05-28

-- 1. Adiciona margem negociável à tabela de lojas
--    Representa a % máxima de desconto que vendedores podem aplicar livremente naquela loja
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS margem_negociavel NUMERIC(5,2) DEFAULT 0
    CONSTRAINT lojas_margem_negociavel_check CHECK (margem_negociavel >= 0 AND margem_negociavel <= 100);

COMMENT ON COLUMN public.lojas.margem_negociavel IS 'Percentual máximo de desconto que vendedores podem conceder livremente (0 = desabilitado)';

-- 2. Adiciona percentual do desconto efetivamente aplicado à venda
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC(5,2);

COMMENT ON COLUMN public.vendas.desconto_percentual IS 'Percentual do desconto aplicado em relação ao subtotal da venda';

-- 3. Adiciona origem do desconto para auditoria
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS desconto_origem TEXT
    CONSTRAINT vendas_desconto_origem_check CHECK (
      desconto_origem IS NULL OR
      desconto_origem IN ('token', 'cupom', 'margem_negociavel', 'arredondamento')
    );

COMMENT ON COLUMN public.vendas.desconto_origem IS 'Origem do desconto: token | cupom | margem_negociavel | arredondamento';

-- 4. Índice para facilitar queries do relatório de descontos por vendedor/loja
CREATE INDEX IF NOT EXISTS idx_vendas_desconto_origem ON public.vendas (desconto_origem)
  WHERE desconto_origem IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendas_responsavel_desconto ON public.vendas (responsavel_id, desconto_origem)
  WHERE desconto > 0;
