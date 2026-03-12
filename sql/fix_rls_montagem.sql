-- Fix RLS policies for montadores and montagens_itens tables
-- Using the project's standard RLS template with WITH CHECK clause

-- montadores
ALTER TABLE montadores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS montadores_policy ON montadores;
DROP POLICY IF EXISTS all_montadores ON montadores;
CREATE POLICY all_montadores ON montadores 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- montagens_itens
ALTER TABLE montagens_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS montagens_itens_policy ON montagens_itens;
DROP POLICY IF EXISTS all_montagens_itens ON montagens_itens;
CREATE POLICY all_montagens_itens ON montagens_itens 
FOR ALL TO authenticated USING (true) WITH CHECK (true);
