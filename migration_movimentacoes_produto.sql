-- ============================================================================
-- Migration: Tabela padronizada de movimentações de estoque por produto
-- ============================================================================
-- Propósito: Criar uma trilha estruturada e auditável de todos os eventos
-- que alteram estoque. Consolida venda, ajuste manual, transferência, 
-- inventário aprovado, recebimento e cancelamento/devolução em um único ponto.
--
-- Dependências: produtos, public_users, clientes (opcional para vendas)
-- ============================================================================

-- Drop existing table (safe: sistema ainda não está em produção)
DROP TABLE IF EXISTS movimentacoes_estoque CASCADE;

CREATE TABLE movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referência do produto (bigint, pois produtos.id é bigint)
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  
  -- Tipo de evento (venda, ajuste_manual, transferencia_saida, transferencia_entrada, inventario, recebimento, cancelamento_devolucao)
  evento_tipo VARCHAR(50) NOT NULL,
  
  -- Módulo de origem (vendas, estoque, compras, logistica, etc)
  modulo_origem VARCHAR(50),
  
  -- Referência ao documento que provocou o movimento
  -- Ex: numero_pedido para vendas, numero_transferencia para transferências, numero_oc para recebimento
  referencia_id UUID,
  referencia_tipo VARCHAR(50), -- tipo do documento que gerou o movimento
  referencia_numero VARCHAR(100), -- número amigável (pedido #123, OC #456)
  
  -- Localização: lojas/CD envolvidas
  loja_origem VARCHAR(100), -- de onde saiu (null para CD ou ajustes globais)
  loja_destino VARCHAR(100), -- para onde foi (null se saída pura, ex: venda)
  
  -- Quantidades e saldos
  quantidade INT NOT NULL, -- quantidade que saiu ou entrou (sempre positivo, sinal fica no evento_tipo)
  estoque_antes_local INT, -- saldo na loja/CD antes do movimento
  estoque_depois_local INT, -- saldo na loja/CD depois do movimento
  estoque_antes_total INT, -- quantidade_estoque geral antes
  estoque_depois_total INT, -- quantidade_estoque geral depois
  
  -- Autoria
  usuario_id UUID REFERENCES public_users(id) ON DELETE SET NULL,
  usuario_nome VARCHAR(255), -- denormalizado para caso o usuário seja deletado
  usuario_cargo VARCHAR(100), -- cargo do usuário no momento do evento
  
  -- Contexto comercial (preenchido para vendas e devoluções)
  cliente_id BIGINT, -- mesmo tipo de clientes.id (bigint)
  cliente_nome VARCHAR(255),
  cliente_contato VARCHAR(50), -- telefone ou email
  
  -- Observações e metadados
  observacao TEXT,
  payload_json JSONB DEFAULT '{}', -- dados adicionais (preco_unitario, desconto, etc)
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Multi-tenant (assumindo organization_id como padrão)
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- Índices para performance em consultas comuns
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_id ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created_at ON movimentacoes_estoque(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_evento_tipo ON movimentacoes_estoque(evento_tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_usuario_id ON movimentacoes_estoque(usuario_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_referencia ON movimentacoes_estoque(referencia_id, referencia_tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_created ON movimentacoes_estoque(produto_id, created_at DESC);

-- Comentário para documentação
COMMENT ON TABLE movimentacoes_estoque IS 'Trilha padronizada de movimentações de estoque. Consolida eventos de venda, ajuste manual, transferência, inventário, recebimento e cancelamento/devolução.';
COMMENT ON COLUMN movimentacoes_estoque.evento_tipo IS 'Tipo de evento: venda, ajuste_manual, transferencia_saida, transferencia_entrada, inventario, recebimento, cancelamento_devolucao';
COMMENT ON COLUMN movimentacoes_estoque.payload_json IS 'Metadados adicionais: {preco_unitario, preco_total, desconto, markup, nfe_chave, numero_montagem, etc}';

-- RLS: Permitir leitura e escrita para usuários autenticados
-- Assumindo padrão multi-tenant da organização
ALTER TABLE movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "movimentacoes_select" ON movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_insert" ON movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_update" ON movimentacoes_estoque;

CREATE POLICY "movimentacoes_select" ON movimentacoes_estoque 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "movimentacoes_insert" ON movimentacoes_estoque 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "movimentacoes_update" ON movimentacoes_estoque 
  FOR UPDATE 
  USING (auth.role() = 'authenticated');
