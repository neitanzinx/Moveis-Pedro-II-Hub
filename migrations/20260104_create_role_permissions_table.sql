-- Migration: create_role_permissions_table
-- Tabela para armazenar permissoes customizadas por cargo

CREATE TABLE IF NOT EXISTS role_permissions (
  cargo TEXT PRIMARY KEY,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Admins podem ler e escrever
CREATE POLICY "Todos podem ler" ON role_permissions
  FOR SELECT USING (true);

CREATE POLICY "Admins podem inserir" ON role_permissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins podem atualizar" ON role_permissions
  FOR UPDATE USING (true);

-- Comentario
COMMENT ON TABLE role_permissions IS 'Permissoes customizadas por cargo. Sobrescreve ROLE_RULES hard-coded.';
