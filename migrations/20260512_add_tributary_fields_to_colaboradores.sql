-- Migration: Add tributary fields to colaboradores table
-- Date: 2026-05-12
-- Description: Adds pensao_alimenticia column to support tributary calculations in payroll

ALTER TABLE public.colaboradores
ADD COLUMN IF NOT EXISTS pensao_alimenticia DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN public.colaboradores.pensao_alimenticia IS 'Valor mensal de pensão alimentícia para dedução na folha e base de cálculo do IRRF. Afeta direto o salário líquido do colaborador.';
