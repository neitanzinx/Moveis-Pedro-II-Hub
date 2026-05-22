-- Migration: Suporte completo à gestão de permissões por UI
-- Adiciona colunas à tabela role_permissions para:
--   scope          — escopo de dados do cargo (all/store/own)
--   denied_permissions — permissões explicitamente removidas do cargo
--   label          — nome de exibição (para cargos personalizados)
--   color          — cor hex (para cargos personalizados)
--   description    — descrição curta do cargo
--   is_custom      — true para cargos criados pela UI (não padrão do sistema)
-- Todas as adições são backward-compatible (IF NOT EXISTS + DEFAULT seguro).

ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS scope             TEXT          NOT NULL DEFAULT 'own';
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS denied_permissions TEXT[]        NOT NULL DEFAULT '{}';
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS label             TEXT;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS color             TEXT;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS description       TEXT;
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS is_custom         BOOLEAN       NOT NULL DEFAULT false;
