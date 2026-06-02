-- Migration: add all columns used by PDV that were missing from entregas table
-- These columns were being sent by the frontend but did not exist in the DB,
-- causing HTTP 400 errors on every Entrega.create() call from the PDV.

ALTER TABLE public.entregas
    ADD COLUMN IF NOT EXISTS prazo_entrega          text,
    ADD COLUMN IF NOT EXISTS forma_pagamento_entrega text,
    ADD COLUMN IF NOT EXISTS preferencias_entrega    jsonb,
    ADD COLUMN IF NOT EXISTS itens_montagem_interna  jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS vendedor_id             uuid,
    ADD COLUMN IF NOT EXISTS loja_id                 uuid,
    ADD COLUMN IF NOT EXISTS data_liberacao          date;

COMMENT ON COLUMN public.entregas.prazo_entrega           IS 'Prazo de entrega como texto legível (ex: "15 dias úteis")';
COMMENT ON COLUMN public.entregas.forma_pagamento_entrega IS 'Forma de pagamento a ser recebida no momento da entrega';
COMMENT ON COLUMN public.entregas.preferencias_entrega    IS 'Preferências de dia/turno para entrega informadas pelo cliente';
COMMENT ON COLUMN public.entregas.itens_montagem_interna  IS 'Lista de itens que serão montados internamente pela equipe';
COMMENT ON COLUMN public.entregas.vendedor_id             IS 'ID do vendedor responsável pela venda que gerou esta entrega';
COMMENT ON COLUMN public.entregas.loja_id                 IS 'ID da loja de origem da venda';
COMMENT ON COLUMN public.entregas.data_liberacao          IS 'Data a partir da qual a entrega pode ser processada pela logística';
