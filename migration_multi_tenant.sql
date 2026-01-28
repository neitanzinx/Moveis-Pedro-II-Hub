-- =====================================================
-- MIGRATION: Multi-Tenant Architecture
-- Transformar sistema single-tenant em SaaS multi-tenant
-- =====================================================

-- 1. CRIAR TABELA DE ORGANIZAÇÕES (TENANTS)
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cnpj TEXT,
  razao_social TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#07593f',
  secondary_color TEXT DEFAULT '#f38a4c',
  whatsapp_suporte TEXT,
  email_suporte TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CRIAR TABELA DE CONFIGURAÇÕES POR ORGANIZAÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  
  -- Prazos
  prazo_entrega_padrao INTEGER DEFAULT 7,
  prazo_montagem_padrao INTEGER DEFAULT 3,
  
  -- Financeiro
  taxa_juros_parcelamento JSONB DEFAULT '{"2x": 0, "3x": 0, "4x": 2.5, "5x": 3, "6x": 3.5, "7x": 4, "8x": 4.5, "9x": 5, "10x": 5.5, "11x": 6, "12x": 6.5}'::jsonb,
  
  -- Comissões
  comissao_base_percentual DECIMAL(5,2) DEFAULT 3.00,
  comissao_sobre TEXT DEFAULT 'bruto' CHECK (comissao_sobre IN ('bruto', 'liquido')),
  
  -- Feature Flags (Módulos Parametrizáveis)
  modulos_ativos JSONB DEFAULT '{
    "montagem": true,
    "assistencia_tecnica": true,
    "nfe": true,
    "marketing": true,
    "rh": true,
    "bi_dashboard": true,
    "catalogo_whatsapp": true
  }'::jsonb,
  
  -- NFe
  nfe_ambiente TEXT DEFAULT 'homologacao' CHECK (nfe_ambiente IN ('homologacao', 'producao')),
  nfe_serie INTEGER DEFAULT 1,
  
  -- Outros
  fuso_horario TEXT DEFAULT 'America/Sao_Paulo',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRIAR TABELA DE LOJAS (SUBSTITUIR HARDCODED)
-- =====================================================
CREATE TABLE IF NOT EXISTS lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT DEFAULT 'MG',
  cep TEXT,
  telefone TEXT,
  is_showroom BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, codigo)
);

-- 4. INSERIR MÓVEIS PEDRO II COMO CLIENTE 01
-- =====================================================
INSERT INTO organizations (id, name, slug, cnpj, razao_social, logo_url, whatsapp_suporte)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Móveis Pedro II',
  'moveis-pedro-ii',
  '04.842.257/0001-41',
  'MOVEIS PEDRO II LTDA',
  'https://stgatkuwnouzwczkpphs.supabase.co/storage/v1/object/public/publico/mp2logo.png',
  '5532999999999'
) ON CONFLICT (slug) DO NOTHING;

-- Inserir configurações padrão para Pedro II
INSERT INTO organization_settings (organization_id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (organization_id) DO NOTHING;

-- Inserir lojas da Pedro II (substituindo hardcoded)
INSERT INTO lojas (organization_id, nome, codigo, cidade, estado) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Loja Centro', 'Centro', 'Manhuaçu', 'MG'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Loja Carangola', 'Carangola', 'Carangola', 'MG'),
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Loja Ponte Branca', 'Ponte Branca', 'Manhuaçu', 'MG')
ON CONFLICT (organization_id, codigo) DO NOTHING;

-- 5. ADICIONAR ORGANIZATION_ID NAS TABELAS EXISTENTES
-- =====================================================
-- Adicionar coluna organization_id com valor padrão para dados existentes

-- Profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Vendedores
ALTER TABLE vendedores 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Vendas
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Orcamentos
ALTER TABLE orcamentos 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Produtos
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Fornecedores
ALTER TABLE fornecedores 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Pedidos de Compra
ALTER TABLE pedidos_compra 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Entregas
ALTER TABLE entregas 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Montagens
ALTER TABLE montagens 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Assistências Técnicas
ALTER TABLE assistencias_tecnicas 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Metas de Vendas
ALTER TABLE metas_vendas 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Tokens Gerenciais
ALTER TABLE tokens_gerenciais 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Cargos
ALTER TABLE cargos 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- 6. HABILITAR RLS NAS NOVAS TABELAS
-- =====================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lojas ENABLE ROW LEVEL SECURITY;

-- 7. CRIAR POLICIES DE ACESSO
-- =====================================================

-- Policy para organizations (usuários veem sua organização)
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy para organization_settings
CREATE POLICY "Users can view their organization settings" ON organization_settings
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update their organization settings" ON organization_settings
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND cargo = 'Administrador'
    )
  );

-- Policy para lojas
CREATE POLICY "Users can view lojas from their organization" ON lojas
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage lojas" ON lojas
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND cargo = 'Administrador'
    )
  );

-- 8. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_lojas_org_id ON lojas(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendas_org_id ON vendas(organization_id);
CREATE INDEX IF NOT EXISTS idx_produtos_org_id ON produtos(organization_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org_id ON clientes(organization_id);

-- 9. COMENTÁRIOS NAS TABELAS
-- =====================================================
COMMENT ON TABLE organizations IS 'Tenants/Empresas do sistema multi-tenant';
COMMENT ON TABLE organization_settings IS 'Configurações personalizáveis por organização';
COMMENT ON TABLE lojas IS 'Lojas/Filiais de cada organização';
COMMENT ON COLUMN organization_settings.modulos_ativos IS 'Feature flags para habilitar/desabilitar módulos';
COMMENT ON COLUMN organization_settings.comissao_sobre IS 'Se a comissão é calculada sobre valor bruto ou líquido';
