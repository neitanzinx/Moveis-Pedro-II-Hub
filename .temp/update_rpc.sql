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
    matricula TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
        u.matricula::TEXT
    FROM public.public_users u
    WHERE u.organization_id = p_org_id
    ORDER BY u.nome ASC;
END;
$$;
