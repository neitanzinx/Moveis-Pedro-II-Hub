-- ============================================================
-- Migration: Nuvem Fiscal → ACBR API
-- Data: 2026-04-29
-- Descrição: Renomeia colunas de credenciais Nuvem Fiscal para ACBR
--            em organization_nfe_configs e notas_fiscais_emitidas.
--            Migração one-way — sem fallback para Nuvem Fiscal.
-- ============================================================

-- 1. Renomear colunas de credenciais em organization_nfe_configs
DO $$
BEGIN
    -- nuvem_client_id → acbr_client_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'nuvem_client_id') THEN
        ALTER TABLE public.organization_nfe_configs RENAME COLUMN nuvem_client_id TO acbr_client_id;
    END IF;

    -- nuvem_client_secret → acbr_client_secret
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'nuvem_client_secret') THEN
        ALTER TABLE public.organization_nfe_configs RENAME COLUMN nuvem_client_secret TO acbr_client_secret;
    END IF;

    -- nuvem_access_token → acbr_access_token
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'nuvem_access_token') THEN
        ALTER TABLE public.organization_nfe_configs RENAME COLUMN nuvem_access_token TO acbr_access_token;
    END IF;

    -- nuvem_token_expires_at → acbr_token_expires_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'nuvem_token_expires_at') THEN
        ALTER TABLE public.organization_nfe_configs RENAME COLUMN nuvem_token_expires_at TO acbr_token_expires_at;
    END IF;

    -- Adicionar colunas caso ainda não existam (para ambientes novos)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'acbr_client_id') THEN
        ALTER TABLE public.organization_nfe_configs ADD COLUMN acbr_client_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'acbr_client_secret') THEN
        ALTER TABLE public.organization_nfe_configs ADD COLUMN acbr_client_secret text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'acbr_access_token') THEN
        ALTER TABLE public.organization_nfe_configs ADD COLUMN acbr_access_token text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'acbr_token_expires_at') THEN
        ALTER TABLE public.organization_nfe_configs ADD COLUMN acbr_token_expires_at timestamptz;
    END IF;
END $$;

-- Invalidar tokens em cache (forçar re-autenticação com ACBR)
UPDATE public.organization_nfe_configs
SET acbr_access_token = NULL, acbr_token_expires_at = NULL;

-- 2. Renomear coluna nuvem_fiscal_id → acbr_id em notas_fiscais_emitidas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notas_fiscais_emitidas' AND column_name = 'nuvem_fiscal_id') THEN
        ALTER TABLE public.notas_fiscais_emitidas RENAME COLUMN nuvem_fiscal_id TO acbr_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notas_fiscais_emitidas' AND column_name = 'acbr_id') THEN
        ALTER TABLE public.notas_fiscais_emitidas ADD COLUMN acbr_id text;
    END IF;
END $$;

-- Atualizar índice se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'notas_fiscais_emitidas' AND indexname = 'idx_notas_fiscais_emitidas_nuvem_fiscal_id') THEN
        DROP INDEX IF EXISTS public.idx_notas_fiscais_emitidas_nuvem_fiscal_id;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notas_fiscais_emitidas_acbr_id
    ON public.notas_fiscais_emitidas(acbr_id);

-- 3. Remover coluna focus_token obsoleta (era da arquitetura anterior)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organization_nfe_configs' AND column_name = 'focus_token') THEN
        ALTER TABLE public.organization_nfe_configs DROP COLUMN focus_token;
    END IF;
END $$;
