-- Migration: Add ACBR certificate onboarding fields
-- Date: 2026-04-30

ALTER TABLE public.organization_nfe_configs
    ADD COLUMN IF NOT EXISTS emitente_email text,
    ADD COLUMN IF NOT EXISTS emitente_codigo_municipio text,
    ADD COLUMN IF NOT EXISTS acbr_empresa_registrada boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS acbr_certificado_validade timestamptz,
    ADD COLUMN IF NOT EXISTS acbr_certificado_thumbprint text;
