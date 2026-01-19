-- Migration: add_custom_permissions_to_users
-- Execute this migration in your Supabase SQL Editor

-- Adicionar campo de permissoes customizadas
ALTER TABLE public_users
ADD COLUMN IF NOT EXISTS custom_permissions JSONB DEFAULT '{"inherit": true, "allowed": [], "denied": []}';

-- Adicionar comentario para documentacao
COMMENT ON COLUMN public_users.custom_permissions IS 'Permissoes customizadas do usuario. inherit=true herda do cargo, allowed/denied sao excecoes.';
