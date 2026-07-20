DO $$
DECLARE
    v_plano_id UUID;
BEGIN
    -- 1. Inserir Plano Vitalício
    INSERT INTO public.planos (nome, slug, preco_mensal, recursos, ativo)
    VALUES (
        'Plano Vitalício', 
        'vitalicio', 
        0.00, 
        '{"whatsapp_bot": true, "fotos_entrega": true}'::jsonb, 
        true
    )
    ON CONFLICT (slug) DO UPDATE 
    SET nome = EXCLUDED.nome,
        preco_mensal = EXCLUDED.preco_mensal,
        recursos = EXCLUDED.recursos,
        ativo = EXCLUDED.ativo
    RETURNING id INTO v_plano_id;

    -- 2. Atualizar a organização "Móveis Pedro II" para usar o plano vitalício
    UPDATE public.organizations
    SET 
        plano_id = v_plano_id,
        status_assinatura = 'ativa',
        asaas_subscription_id = NULL
    WHERE nome ILIKE '%Móveis Pedro II%' OR nome ILIKE '%Moveis Pedro II%';

    -- 3. Garantir que os módulos do plano vitalício estão ativos na empresa
    UPDATE public.organization_settings
    SET modulos_ativos = '{"whatsapp_bot": true, "fotos_entrega": true}'::jsonb,
        updated_at = NOW()
    WHERE organization_id IN (
        SELECT id FROM public.organizations 
        WHERE nome ILIKE '%Móveis Pedro II%' OR nome ILIKE '%Moveis Pedro II%'
    );
END $$;
