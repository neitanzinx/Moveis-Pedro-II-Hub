-- =====================================================
-- MIGRAÇÃO: Colunas de Notificação WhatsApp em Entregas
-- Data: 2025-12-21
-- =====================================================

-- Adicionar colunas de notificação na tabela entregas
ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean DEFAULT false;

ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS status_confirmacao text;

ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS data_notificacao text;

ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS turno_notificacao text;

ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS ultima_notificacao timestamptz;

COMMENT ON COLUMN entregas.whatsapp_enviado IS 'Se a confirmação por WhatsApp foi enviada';
COMMENT ON COLUMN entregas.status_confirmacao IS 'Status: Aguardando Resposta, Confirmada, Cancelada';
COMMENT ON COLUMN entregas.data_notificacao IS 'Data para qual a notificação foi enviada';
COMMENT ON COLUMN entregas.turno_notificacao IS 'Turno para qual a notificação foi enviada';
COMMENT ON COLUMN entregas.ultima_notificacao IS 'Timestamp da última notificação enviada';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
