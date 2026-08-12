-- ============================================================================
-- Permitir leitura pública dos planos (Landing Page e Cadastro)
-- ============================================================================

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

-- Política para autenticados
DROP POLICY IF EXISTS all_planos ON public.planos;
CREATE POLICY all_planos ON public.planos 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Política para usuários anônimos (Landing Page e visitantes públicos)
DROP POLICY IF EXISTS select_planos_anon ON public.planos;
CREATE POLICY select_planos_anon ON public.planos 
FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS select_planos_public ON public.planos;
CREATE POLICY select_planos_public ON public.planos 
FOR SELECT TO public USING (true);

NOTIFY pgrst, 'reload schema';
