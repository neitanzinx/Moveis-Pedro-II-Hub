-- Migration: add data_liberacao column to entregas
-- This column stores the "release from" date when a customer asks to hold the delivery (e.g., waiting for construction to finish)
-- When set, logistics sees a message "Este pedido será liberado a partir de [data]"
-- Auto-release happens in the frontend when today >= data_liberacao

ALTER TABLE entregas ADD COLUMN IF NOT EXISTS data_liberacao date;

COMMENT ON COLUMN entregas.data_liberacao IS 'Data a partir da qual a entrega pode ser processada pela logística (aguardar liberação)';
