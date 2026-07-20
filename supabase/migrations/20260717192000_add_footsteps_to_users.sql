-- 1. ADICIONAR COLUNA PARA GUARDAR AS PEGADAS NO USUÁRIO
-- Usando JSONB para flexibilidade e eficiência de espaço
ALTER TABLE public.public_users ADD COLUMN IF NOT EXISTS last_footsteps JSONB DEFAULT '[]'::jsonb;

-- 2. FUNÇÃO SQL PARA ADICIONAR UMA PEGADA E MANTER O LIMITE DE 15 ITENS
-- Security definer garante que o usuário pode rodar a função mesmo que a tabela tenha RLS
CREATE OR REPLACE FUNCTION public.track_user_footstep(p_user_id UUID, p_step JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.public_users
  SET last_footsteps = (
    SELECT jsonb_agg(elem)
    FROM (
      -- Nova pegada no topo + pegadas anteriores (limitado a 15 no total)
      SELECT elem FROM (
        SELECT p_step AS elem
        UNION ALL
        SELECT jsonb_array_elements(COALESCE(last_footsteps, '[]'::jsonb)) AS elem
      ) s
      LIMIT 15
    ) t
  )
  WHERE id = p_user_id;
END;
$$;

-- 3. RECREAR FUNÇÃO DE BUSCA DO OPERADOR INCLUINDO AS PEGADAS (last_footsteps)
DROP FUNCTION IF EXISTS public.operator_get_organization_users(UUID);

CREATE OR REPLACE FUNCTION public.operator_get_organization_users(p_org_id UUID)
RETURNS TABLE (
    id UUID,
    nome TEXT,
    email TEXT,
    cargo TEXT,
    ativo BOOLEAN,
    status_aprovacao TEXT,
    ultimo_login TIMESTAMP WITH TIME ZONE,
    matricula TEXT,
    last_footsteps JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_saas_operator() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas operadores podem visualizar usuários de outras organizações.';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.nome,
        u.email,
        u.cargo,
        u.ativo,
        u.status_aprovacao,
        u.ultimo_login,
        u.matricula::TEXT,
        COALESCE(u.last_footsteps, '[]'::jsonb)
    FROM public.public_users u
    WHERE u.organization_id = p_org_id
    ORDER BY u.nome ASC;
END;
$$;

