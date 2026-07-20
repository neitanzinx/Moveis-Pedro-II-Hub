-- 1. Função para buscar os usuários de uma organização
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

-- 2. Função para alternar o status do usuário (bloquear/desbloquear)
CREATE OR REPLACE FUNCTION public.operator_toggle_user_status(p_user_id UUID, p_ativo BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_saas_operator() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- Atualiza a tabela public_users
    UPDATE public.public_users 
    SET ativo = p_ativo
    WHERE id = p_user_id;
    
    -- Opcional: Se p_ativo for falso, poderíamos banir no auth.users também,
    -- Mas o próprio middleware ou policies do app geralmente impedem login se ativo = false.
    -- Vamos deixar simples por agora, contando com o 'ativo' do public_users.
END;
$$;
