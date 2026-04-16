-- Migration: Adiciona campos de responsabilidade do montador em assistencias_tecnicas
-- Data: 2026-04-16
-- Objetivo: Permitir vincular uma assistência técnica ao montador responsável,
--           exibindo-a na aba "Assistências" do portal do Montador Externo.

-- Coluna booleana: marca se a assistência é de responsabilidade do montador
ALTER TABLE assistencias_tecnicas
    ADD COLUMN IF NOT EXISTS responsabilidade_montador BOOLEAN NOT NULL DEFAULT FALSE;

-- Coluna de vínculo: armazena o UUID (como TEXT) do usuário montador (public_users.id)
-- Segue o mesmo padrão de montagens_itens.montador_id (UUID armazenado como TEXT)
ALTER TABLE assistencias_tecnicas
    ADD COLUMN IF NOT EXISTS montador_usuario_id TEXT NULL;

-- Índice para filtrar rapidamente as assistências de um montador específico
CREATE INDEX IF NOT EXISTS idx_assistencias_montador_usuario_id
    ON assistencias_tecnicas (montador_usuario_id)
    WHERE montador_usuario_id IS NOT NULL;

-- Índice para filtrar apenas as marcadas como responsabilidade do montador
CREATE INDEX IF NOT EXISTS idx_assistencias_responsabilidade_montador
    ON assistencias_tecnicas (responsabilidade_montador)
    WHERE responsabilidade_montador = TRUE;
