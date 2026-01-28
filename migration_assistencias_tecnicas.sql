-- Migration: Criar tabela assistencias_tecnicas
-- Substituindo a funcionalidade de devolucoes por um módulo mais completo de assistência técnica

-- Tabela principal de assistências técnicas
CREATE TABLE IF NOT EXISTS assistencias_tecnicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Referência obrigatória ao pedido (vendas usa BIGINT para id)
  venda_id BIGINT NOT NULL REFERENCES vendas(id) ON DELETE RESTRICT,
  numero_pedido VARCHAR(50) NOT NULL,
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_telefone VARCHAR(50),
  
  -- Classificação da assistência
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'Devolução', 
    'Troca', 
    'Peça Faltante', 
    'Conserto', 
    'Visita Técnica',
    'Outros'
  )),
  
  -- Dados principais
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_resolucao DATE,
  descricao_problema TEXT NOT NULL,
  solucao_aplicada TEXT,
  
  -- Itens envolvidos (JSON array)
  itens_envolvidos JSONB DEFAULT '[]',
  
  -- Valores
  valor_devolvido DECIMAL(10,2) DEFAULT 0,
  valor_cobrado DECIMAL(10,2) DEFAULT 0,
  
  -- Status e aprovação
  status VARCHAR(50) NOT NULL DEFAULT 'Aberta' CHECK (status IN (
    'Aberta',
    'Em Andamento', 
    'Aguardando Peça',
    'Aguardando Cliente',
    'Concluída',
    'Cancelada'
  )),
  prioridade VARCHAR(20) DEFAULT 'Normal' CHECK (prioridade IN ('Baixa', 'Normal', 'Alta', 'Urgente')),
  
  -- Responsável
  responsavel_id UUID REFERENCES public_users(id),
  responsavel_nome VARCHAR(255),
  
  -- Arquivos anexos (URLs do Supabase Storage)
  arquivos JSONB DEFAULT '[]',
  
  -- Observações internas
  observacoes TEXT,
  
  -- Histórico de mudanças de status (array de objetos com status_anterior, status_novo, data, usuario)
  historico JSONB DEFAULT '[]'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_assistencias_venda_id ON assistencias_tecnicas(venda_id);
CREATE INDEX IF NOT EXISTS idx_assistencias_status ON assistencias_tecnicas(status);
CREATE INDEX IF NOT EXISTS idx_assistencias_tipo ON assistencias_tecnicas(tipo);
CREATE INDEX IF NOT EXISTS idx_assistencias_data ON assistencias_tecnicas(data_abertura DESC);

-- RLS Policies
ALTER TABLE assistencias_tecnicas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Authenticated can view assistencias" ON assistencias_tecnicas;
DROP POLICY IF EXISTS "Authenticated can insert assistencias" ON assistencias_tecnicas;
DROP POLICY IF EXISTS "Authenticated can update assistencias" ON assistencias_tecnicas;
DROP POLICY IF EXISTS "Authenticated can delete assistencias" ON assistencias_tecnicas;

CREATE POLICY "Authenticated can view assistencias" ON assistencias_tecnicas
  FOR SELECT TO authenticated USING (true);
  
CREATE POLICY "Authenticated can insert assistencias" ON assistencias_tecnicas
  FOR INSERT TO authenticated WITH CHECK (true);
  
CREATE POLICY "Authenticated can update assistencias" ON assistencias_tecnicas
  FOR UPDATE TO authenticated USING (true);
  
CREATE POLICY "Authenticated can delete assistencias" ON assistencias_tecnicas
  FOR DELETE TO authenticated USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_assistencias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assistencias_updated_at ON assistencias_tecnicas;
CREATE TRIGGER trigger_assistencias_updated_at
  BEFORE UPDATE ON assistencias_tecnicas
  FOR EACH ROW
  EXECUTE FUNCTION update_assistencias_updated_at();
