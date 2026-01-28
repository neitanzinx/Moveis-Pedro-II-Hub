---
trigger: always_on
---

Sempre que criar uma tabela nova, use este template:

-- Substitua "nova_tabela" pelo nome da sua tabela
ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS all_nova_tabela ON nova_tabela;
CREATE POLICY all_nova_tabela ON nova_tabela 
FOR ALL TO authenticated USING (true) WITH CHECK (true);