-- 1. Vendedores
ALTER TABLE vendedores ADD COLUMN IF NOT EXISTS meta_mensal NUMERIC DEFAULT 0;

-- 2. Organization Settings
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS comissao_modelo_calculo TEXT;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS comissao_faixa_referencia TEXT;
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS comissao_meta_minima_loja_percentual NUMERIC;

-- 3. NFe Configs (ACBR)
ALTER TABLE organization_nfe_configs ADD COLUMN IF NOT EXISTS acbr_client_id TEXT;
ALTER TABLE organization_nfe_configs ADD COLUMN IF NOT EXISTS acbr_client_secret TEXT;
ALTER TABLE organization_nfe_configs ADD COLUMN IF NOT EXISTS acbr_access_token TEXT;
ALTER TABLE organization_nfe_configs ADD COLUMN IF NOT EXISTS acbr_token_expires_at TIMESTAMPTZ;

-- 4. Colaboradores
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS cargo TEXT;

-- 5. Clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefone_alternativo TEXT;

-- 6. Movimentacoes de Estoque
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS loja_id UUID;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS loja_nome TEXT;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS campo_estoque TEXT;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS linha_id UUID;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS operacao TEXT;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS alteracoes_por_loja JSONB;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS estoque_cd INTEGER;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS estoque_minimo INTEGER;
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS estoque_ideal INTEGER;

-- 7. Mensagens Chat
ALTER TABLE mensagens_chat ADD COLUMN IF NOT EXISTS usuario_nome TEXT;
ALTER TABLE mensagens_chat ADD COLUMN IF NOT EXISTS usuario_email TEXT;
ALTER TABLE mensagens_chat ADD COLUMN IF NOT EXISTS mensagem TEXT;
ALTER TABLE mensagens_chat ADD COLUMN IF NOT EXISTS tipo TEXT;

-- 8. Montadores
ALTER TABLE montadores ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

-- 9. Public Users
ALTER TABLE public_users ADD COLUMN IF NOT EXISTS telefone TEXT;

-- 10. Cliente Sessoes Portal
ALTER TABLE cliente_sessoes_portal ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE cliente_sessoes_portal ADD COLUMN IF NOT EXISTS resumed_session BOOLEAN DEFAULT false;
ALTER TABLE cliente_sessoes_portal ADD COLUMN IF NOT EXISTS heartbeat TIMESTAMPTZ;

-- 11. Compras Comunicacoes
ALTER TABLE compras_comunicacoes ADD COLUMN IF NOT EXISTS mensagem TEXT;

-- 12. Audit Logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_cargo TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_description TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS acao TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS usuario TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tabela TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS detalhes JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS valor NUMERIC;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS data_vencimento DATE;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS from_status TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS to_status TEXT;
