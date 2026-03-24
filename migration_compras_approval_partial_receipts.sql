/**
 * MIGRATION: Approval Workflow + Partial Receipts para Compras
 * Data: 2026-03-20
 * 
 * Implementa:
 * 1. Fluxo de aprovação de OCs (Rascunho → Aguardando Aprovação → Aguardando Envio → Pedido Enviado → Recebido)
 * 2. Recebimentos parciais com histórico
 */

-- ============================================================================
-- 1. ADD FIELDS TO compras_ordens FOR APPROVAL WORKFLOW
-- ============================================================================

ALTER TABLE compras_ordens 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT NULL, -- Pendente, Aprovado, Rejeitado
ADD COLUMN IF NOT EXISTS approved_by UUID DEFAULT NULL,            -- ID do aprovador (user)
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP DEFAULT NULL,     -- Data da aprovação
ADD COLUMN IF NOT EXISTS approval_comments TEXT DEFAULT NULL;      -- Comentários da aprovação/rejeição

-- ============================================================================
-- 2. ENSURE compras_oc_itens HAS RECEIPT TRACKING FIELDS
-- ============================================================================

ALTER TABLE compras_oc_itens 
ADD COLUMN IF NOT EXISTS quantidade_recebida INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_recebimento VARCHAR(50) DEFAULT 'Pendente'; -- Pendente, Parcial, Completo

-- Add comment for clarity
COMMENT ON COLUMN compras_oc_itens.quantidade_recebida IS 'Total recebido deste item (pode ser parcial)';
COMMENT ON COLUMN compras_oc_itens.status_recebimento IS 'Pendente = nada recebido, Parcial = qtd < quantidade, Completo = qtd = quantidade';

-- ============================================================================
-- 3. CREATE RECEBIMENTOS HISTORY TABLE FOR AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS compras_recebimentos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, -- Removed direct reference to auth.tenants for now

  ordem_compra_id UUID NOT NULL REFERENCES compras_ordens(id) ON DELETE CASCADE,
  numero_oc VARCHAR(50) NOT NULL,  -- Cópia desnormalizada para facilitar busca
  
  -- Rastreamento de recebimento
  numero_nfe VARCHAR(44),          -- Chave da NF-e
  data_recebimento TIMESTAMP NOT NULL DEFAULT NOW(),
  recebido_por UUID NOT NULL,      -- ID do usuário que registrou
  
  observacoes TEXT,
  
  -- Controle
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add a comment to clarify the tenant_id usage
COMMENT ON COLUMN compras_recebimentos_historico.tenant_id IS 'Tenant ID; ensure it matches your multi-tenant architecture';

CREATE INDEX IF NOT EXISTS idx_recebimentos_oc ON compras_recebimentos_historico(ordem_compra_id);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data ON compras_recebimentos_historico(data_recebimento);

-- ============================================================================
-- 4. CREATE RECEBIMENTOS_ITENS TABLE (detail per item in each receipt)
-- ============================================================================

CREATE TABLE IF NOT EXISTS compras_recebimentos_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  recebimento_id UUID NOT NULL REFERENCES compras_recebimentos_historico(id) ON DELETE CASCADE,
  oc_item_id UUID NOT NULL REFERENCES compras_oc_itens(id) ON DELETE CASCADE,
  
  quantidade_recebida INTEGER NOT NULL,
  preco_unitario NUMERIC(12, 2),  -- Pode ser ajustado da NF-e
  observacao_item TEXT,           -- Danos, falta, etc
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recebimento_itens ON compras_recebimentos_itens(recebimento_id);

-- ============================================================================
-- 5. UPDATE COMPRAS_ORDENS STATUS FSM
-- ============================================================================

-- Validar que status_anterior permite transição para novo status
-- Estados válidos com Approval:
-- Rascunho → Aguardando Aprovação (ao clicar "Enviar para Aprovação")
-- Aguardando Aprovação → Aguardando Envio (ao Aprovar) ou → Rascunho (ao Rejeitar)
-- Aguardando Envio → Pedido Enviado (ao clicar "Enviar ao Fornecedor")
-- Pedido Enviado → Parcialmente Recebido (ao receber parcial)
-- Pedido Enviado → Recebido (ao receber tudo)
-- Parcialmente Recebido → Recebido (ao receber restante)
-- * → Cancelada (em qualquer estado)

COMMENT ON TABLE compras_ordens IS 'FSM: Rascunho→AguardandoAprovacao→AguardandoEnvio→PedidoEnviado→ParcialmenteRecebido→Recebido OR Cancelada em qualquer estado';

-- ============================================================================
-- 6. RLS POLICIES (if not already set)
-- ============================================================================

-- Verificar se RLS está habilitado
ALTER TABLE compras_recebimentos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras_recebimentos_itens ENABLE ROW LEVEL SECURITY;

-- Policy for recebimentos (mesmo tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rls_recebimentos_tenant'
  ) THEN
    CREATE POLICY rls_recebimentos_tenant 
    ON compras_recebimentos_historico 
    USING (tenant_id = auth.uid()::uuid); -- Ou usar current_setting('app.tenant_id')
  END IF;
END $$;

-- Policy for recebimentos_itens (mesmo tenant)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'rls_recebimentos_itens_tenant'
  ) THEN
    CREATE POLICY rls_recebimentos_itens_tenant 
    ON compras_recebimentos_itens 
    USING (
      recebimento_id IN (
        SELECT id FROM compras_recebimentos_historico 
        WHERE tenant_id = auth.uid()::uuid -- Ou current_setting('app.tenant_id')
      )
    );
  END IF;
END $$;

-- ============================================================================
-- 7. SAMPLE TEST DATA (optional, comment out if not needed)
-- ============================================================================

-- INSERT INTO compras_ordens (id, tenant_id, numero_pedido, fornecedor_id, status, approval_status, created_at)
-- VALUES (
--   gen_random_uuid(),
--   '00000000-0000-0000-0000-000000000001',
--   'OC-2026-99999',
--   '00000000-0000-0000-0000-000000000099',
--   'Aguardando Aprovacao',
--   'Pendente',
--   NOW()
-- );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Ver estrutura de compras_ordens
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'compras_ordens';

-- Ver estrutura de compras_oc_itens  
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'compras_oc_itens';

-- Verificar tabelas novas criadas
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'compras_recebimentos%';
