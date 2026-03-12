-- Adicionar coluna pin_montagem à tabela public_users
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS pin_montagem VARCHAR(4);

-- Comentário para documentação
COMMENT ON COLUMN public_users.pin_montagem IS 'PIN de 4 dígitos para autorização de montagens internas.';
