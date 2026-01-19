-- =====================================================
-- MIGRAÇÃO: Cargos Mobile e Campo de Aprovação
-- Data: 2025-12-21
-- =====================================================

-- 1. Adicionar cargos para apps mobile (se não existirem)
INSERT INTO cargos (nome, permissoes)
SELECT 'Entregador', '{"can": ["view_mobile_entregador"], "scope": "own"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cargos WHERE nome = 'Entregador');

INSERT INTO cargos (nome, permissoes)
SELECT 'Montador Externo', '{"can": ["view_mobile_montador"], "scope": "own"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cargos WHERE nome = 'Montador Externo');

-- 2. Adicionar campo de aprovação na tabela de usuários
ALTER TABLE public_users 
ADD COLUMN IF NOT EXISTS aprovado boolean DEFAULT false;

ALTER TABLE public_users 
ADD COLUMN IF NOT EXISTS status_cadastro text DEFAULT 'ativo';

-- Existentes são aprovados automaticamente
UPDATE public_users SET aprovado = true WHERE aprovado IS NULL;

COMMENT ON COLUMN public_users.aprovado IS 'Se o cadastro foi aprovado pela administração';
COMMENT ON COLUMN public_users.status_cadastro IS 'Status: pendente, ativo, rejeitado';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
