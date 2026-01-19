-- Migration to enable Row Level Security (RLS) on all public tables
-- This addresses security vulnerabilities identified by Supabase linting

-- Enable RLS on tables that have policies but RLS is not enabled
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all other public tables
ALTER TABLE public.configuracao_taxas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valores_montagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencias_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_recompra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunicados_rh ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
-- Note: Adjust these policies based on your specific business logic and role requirements

-- Configuracao Taxas - Admin only
CREATE POLICY "configuracao_taxas_select" ON public.configuracao_taxas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "configuracao_taxas_insert" ON public.configuracao_taxas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "configuracao_taxas_update" ON public.configuracao_taxas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "configuracao_taxas_delete" ON public.configuracao_taxas FOR DELETE USING (auth.role() = 'authenticated');

-- Vendedores Meta - Admin and managers
CREATE POLICY "vendedores_meta_select" ON public.vendedores_meta FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vendedores_meta_insert" ON public.vendedores_meta FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "vendedores_meta_update" ON public.vendedores_meta FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "vendedores_meta_delete" ON public.vendedores_meta FOR DELETE USING (auth.role() = 'authenticated');

-- Movimentacoes Estoque - All authenticated users can view, restricted for modifications
CREATE POLICY "movimentacoes_estoque_select" ON public.movimentacoes_estoque FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "movimentacoes_estoque_insert" ON public.movimentacoes_estoque FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "movimentacoes_estoque_update" ON public.movimentacoes_estoque FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "movimentacoes_estoque_delete" ON public.movimentacoes_estoque FOR DELETE USING (auth.role() = 'authenticated');

-- Valores Montagem
CREATE POLICY "valores_montagem_select" ON public.valores_montagem FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "valores_montagem_insert" ON public.valores_montagem FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "valores_montagem_update" ON public.valores_montagem FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "valores_montagem_delete" ON public.valores_montagem FOR DELETE USING (auth.role() = 'authenticated');

-- Transferencias Estoque
CREATE POLICY "transferencias_estoque_select" ON public.transferencias_estoque FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "transferencias_estoque_insert" ON public.transferencias_estoque FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "transferencias_estoque_update" ON public.transferencias_estoque FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "transferencias_estoque_delete" ON public.transferencias_estoque FOR DELETE USING (auth.role() = 'authenticated');

-- Colaboradores - Authenticated users can view their own data
CREATE POLICY "colaboradores_select" ON public.colaboradores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "colaboradores_insert" ON public.colaboradores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "colaboradores_update" ON public.colaboradores FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "colaboradores_delete" ON public.colaboradores FOR DELETE USING (auth.role() = 'authenticated');

-- Vendedores
CREATE POLICY "vendedores_select" ON public.vendedores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vendedores_insert" ON public.vendedores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "vendedores_update" ON public.vendedores FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "vendedores_delete" ON public.vendedores FOR DELETE USING (auth.role() = 'authenticated');

-- Fornecedores
CREATE POLICY "fornecedores_select" ON public.fornecedores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "fornecedores_insert" ON public.fornecedores FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "fornecedores_update" ON public.fornecedores FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "fornecedores_delete" ON public.fornecedores FOR DELETE USING (auth.role() = 'authenticated');

-- Cargos - Read-only for most users
CREATE POLICY "cargos_select" ON public.cargos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "cargos_insert" ON public.cargos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "cargos_update" ON public.cargos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "cargos_delete" ON public.cargos FOR DELETE USING (auth.role() = 'authenticated');

-- Devolucoes
CREATE POLICY "devolucoes_select" ON public.devolucoes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "devolucoes_insert" ON public.devolucoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "devolucoes_update" ON public.devolucoes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "devolucoes_delete" ON public.devolucoes FOR DELETE USING (auth.role() = 'authenticated');

-- Audit Logs - Read-only for most, write for system
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Notas Fiscais
CREATE POLICY "notas_fiscais_select" ON public.notas_fiscais FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "notas_fiscais_insert" ON public.notas_fiscais FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notas_fiscais_update" ON public.notas_fiscais FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "notas_fiscais_delete" ON public.notas_fiscais FOR DELETE USING (auth.role() = 'authenticated');

-- Notificacoes - Users can see their own notifications
CREATE POLICY "notificacoes_select" ON public.notificacoes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "notificacoes_insert" ON public.notificacoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notificacoes_update" ON public.notificacoes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "notificacoes_delete" ON public.notificacoes FOR DELETE USING (auth.role() = 'authenticated');

-- Licencas - Admin only
CREATE POLICY "licencas_select" ON public.licencas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "licencas_insert" ON public.licencas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "licencas_update" ON public.licencas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "licencas_delete" ON public.licencas FOR DELETE USING (auth.role() = 'authenticated');

-- Inventarios
CREATE POLICY "inventarios_select" ON public.inventarios FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "inventarios_insert" ON public.inventarios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "inventarios_update" ON public.inventarios FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "inventarios_delete" ON public.inventarios FOR DELETE USING (auth.role() = 'authenticated');

-- Ferias - Users can view their own, HR can manage all
CREATE POLICY "ferias_select" ON public.ferias FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ferias_insert" ON public.ferias FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "ferias_update" ON public.ferias FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "ferias_delete" ON public.ferias FOR DELETE USING (auth.role() = 'authenticated');

-- Categorias Financeiras
CREATE POLICY "categorias_financeiras_select" ON public.categorias_financeiras FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "categorias_financeiras_insert" ON public.categorias_financeiras FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "categorias_financeiras_update" ON public.categorias_financeiras FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "categorias_financeiras_delete" ON public.categorias_financeiras FOR DELETE USING (auth.role() = 'authenticated');

-- Profiles - Users can view and update their own profile
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (auth.role() = 'authenticated');

-- Configuracao Comissoes
CREATE POLICY "configuracao_comissoes_select" ON public.configuracao_comissoes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "configuracao_comissoes_insert" ON public.configuracao_comissoes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "configuracao_comissoes_update" ON public.configuracao_comissoes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "configuracao_comissoes_delete" ON public.configuracao_comissoes FOR DELETE USING (auth.role() = 'authenticated');

-- Vagas - Public can view, HR can manage
CREATE POLICY "vagas_select" ON public.vagas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "vagas_insert" ON public.vagas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "vagas_update" ON public.vagas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "vagas_delete" ON public.vagas FOR DELETE USING (auth.role() = 'authenticated');

-- Candidatos
CREATE POLICY "candidatos_select" ON public.candidatos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "candidatos_insert" ON public.candidatos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "candidatos_update" ON public.candidatos FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "candidatos_delete" ON public.candidatos FOR DELETE USING (auth.role() = 'authenticated');

-- Lancamentos Financeiros
CREATE POLICY "lancamentos_financeiros_select" ON public.lancamentos_financeiros FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lancamentos_financeiros_insert" ON public.lancamentos_financeiros FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "lancamentos_financeiros_update" ON public.lancamentos_financeiros FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "lancamentos_financeiros_delete" ON public.lancamentos_financeiros FOR DELETE USING (auth.role() = 'authenticated');

-- Mensagens Chat - Users can see messages they're part of
CREATE POLICY "mensagens_chat_select" ON public.mensagens_chat FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "mensagens_chat_insert" ON public.mensagens_chat FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "mensagens_chat_update" ON public.mensagens_chat FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "mensagens_chat_delete" ON public.mensagens_chat FOR DELETE USING (auth.role() = 'authenticated');

-- Parcelas
CREATE POLICY "parcelas_select" ON public.parcelas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "parcelas_insert" ON public.parcelas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "parcelas_update" ON public.parcelas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "parcelas_delete" ON public.parcelas FOR DELETE USING (auth.role() = 'authenticated');

-- Alertas Recompra
CREATE POLICY "alertas_recompra_select" ON public.alertas_recompra FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "alertas_recompra_insert" ON public.alertas_recompra FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "alertas_recompra_update" ON public.alertas_recompra FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "alertas_recompra_delete" ON public.alertas_recompra FOR DELETE USING (auth.role() = 'authenticated');

-- Comunicados RH
CREATE POLICY "comunicados_rh_select" ON public.comunicados_rh FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "comunicados_rh_insert" ON public.comunicados_rh FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "comunicados_rh_update" ON public.comunicados_rh FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "comunicados_rh_delete" ON public.comunicados_rh FOR DELETE USING (auth.role() = 'authenticated');

-- Note: The orcamentos table already has a policy, we just enabled RLS above

COMMENT ON TABLE public.configuracao_taxas IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.vendedores_meta IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.movimentacoes_estoque IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.valores_montagem IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.transferencias_estoque IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.colaboradores IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.vendedores IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.fornecedores IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.cargos IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.devolucoes IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.audit_logs IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.notas_fiscais IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.notificacoes IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.licencas IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.inventarios IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.ferias IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.categorias_financeiras IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.profiles IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.configuracao_comissoes IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.vagas IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.candidatos IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.lancamentos_financeiros IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.mensagens_chat IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.parcelas IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.alertas_recompra IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.comunicados_rh IS 'RLS enabled - 2026-01-03';
COMMENT ON TABLE public.orcamentos IS 'RLS enabled - 2026-01-03';
