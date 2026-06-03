-- Adiciona colunas para a logo da etiqueta na tabela de organizações
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_etiqueta_url TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS logo_etiqueta_option TEXT DEFAULT 'default';

-- Garante que exista política de atualização para organizações (apenas administradores)
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;
CREATE POLICY "Admins can update their organization" ON public.organizations
  FOR UPDATE USING (
    id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND cargo = 'Administrador'
    )
  );
