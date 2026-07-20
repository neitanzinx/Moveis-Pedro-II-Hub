import React, { useState, useEffect } from "react";
import { ShieldAlert, Trash2, Search, Building2, Activity, Users, MoreVertical, XCircle, FileText, Key, Lock, Unlock, Mail, Footprints } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PainelSaaSOperadorEmpresas() {
  const [organizations, setOrganizations] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState({});

  // States for Modals
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  
  // Access Modal States
  const [selectedOrgUsers, setSelectedOrgUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Footsteps Modal States
  const [activeFootstepsUser, setActiveFootstepsUser] = useState(null);
  const [isFootstepsModalOpen, setIsFootstepsModalOpen] = useState(false);

  // Org Footsteps Feed States
  const [isOrgFootstepsModalOpen, setIsOrgFootstepsModalOpen] = useState(false);
  const [orgFootsteps, setOrgFootsteps] = useState([]);
  const [loadingOrgFootsteps, setLoadingOrgFootsteps] = useState(false);

  // Override Form
  const [overridePlanId, setOverridePlanId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsRes, planosRes, usageRes] = await Promise.all([
        supabase.from("organizations").select(`
          id, name, plano_id, status_assinatura, asaas_customer_id, asaas_subscription_id, created_at, deleted_at,
          organization_settings ( modulos_ativos )
        `).order("created_at", { ascending: false }),
        supabase.from("planos").select("*").order("preco_mensal", { ascending: true }),
        supabase.from("saas_tenant_daily_usage").select("organization_id, active_users, total_events")
      ]);

      if (orgsRes.error) throw orgsRes.error;
      if (planosRes.error) throw planosRes.error;
      
      // Aggregate usage data by organization
      const usageMap = {};
      if (usageRes.data) {
        usageRes.data.forEach(row => {
          if (!usageMap[row.organization_id]) {
            usageMap[row.organization_id] = { active_users: 0, total_events: 0 };
          }
          usageMap[row.organization_id].active_users += row.active_users || 0;
          usageMap[row.organization_id].total_events += row.total_events || 0;
        });
      }

      setOrganizations(orgsRes.data || []);
      setPlanos(planosRes.data || []);
      setUsageData(usageMap);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openOverrideModal = (org) => {
    setSelectedOrg(org);
    setOverridePlanId(org.plano_id || "");
    setOverrideReason("");
    setIsOverrideModalOpen(true);
  };

  const openDetailsModal = (org) => {
    setSelectedOrg(org);
    setIsDetailsModalOpen(true);
  };

  const openDeleteModal = (org) => {
    setSelectedOrg(org);
    setIsDeleteModalOpen(true);
  };

  const openAccessModal = async (org) => {
    setSelectedOrg(org);
    setUserSearchTerm("");
    setIsAccessModalOpen(true);
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.rpc('operator_get_organization_users', {
        p_org_id: org.id
      });
      if (error) throw error;
      setSelectedOrgUsers(data || []);
    } catch (err) {
      toast.error("Erro ao carregar usuários.");
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openOrgFootstepsModal = async (org) => {
    setSelectedOrg(org);
    setIsOrgFootstepsModalOpen(true);
    setLoadingOrgFootsteps(true);
    try {
      const { data, error } = await supabase.rpc('operator_get_organization_users', {
        p_org_id: org.id
      });
      if (error) throw error;
      
      let allFootsteps = [];
      if (data) {
        data.forEach(user => {
          if (user.last_footsteps && Array.isArray(user.last_footsteps)) {
            user.last_footsteps.forEach(step => {
              allFootsteps.push({
                ...step,
                userName: user.nome,
                userEmail: user.email
              });
            });
          }
        });
      }
      
      // Sort by timestamp descending (newest first)
      allFootsteps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setOrgFootsteps(allFootsteps);
    } catch (err) {
      toast.error("Erro ao carregar atividades.");
      console.error(err);
    } finally {
      setLoadingOrgFootsteps(false);
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideReason) {
      toast.error("O motivo é obrigatório para auditoria.");
      return;
    }

    setIsOverriding(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('operator_override_subscription', {
        p_organization_id: selectedOrg.id,
        p_new_plano_id: overridePlanId || null,
        p_reason: overrideReason,
        p_operator_id: authData?.user?.id
      });

      if (error) throw error;

      toast.success("Assinatura alterada com sucesso!");
      setIsOverrideModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao realizar override.");
    } finally {
      setIsOverriding(false);
    }
  };

  const handleCancelPlan = async (org) => {
    if (!confirm(`Tem certeza que deseja FINALIZAR o plano da empresa ${org.name}? Eles perderão acesso premium.`)) return;
    
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ status_assinatura: 'cancelada' })
        .eq('id', org.id);
        
      if (error) throw error;
      toast.success("Plano finalizado.");
      fetchData();
    } catch (err) {
      toast.error("Erro ao finalizar plano.");
    }
  };

  const handleDeleteCompany = async () => {
    setIsDeleting(true);
    try {
      // Agenda a exclusão (Soft Delete temporário de 90 dias)
      const { error } = await supabase.rpc('schedule_organization_deletion', {
        p_org_id: selectedOrg.id
      });

      if (error) throw error;
      toast.success("Empresa agendada para exclusão (90 dias).");
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao agendar exclusão.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreCompany = async (org) => {
    try {
      const { error } = await supabase.rpc('restore_organization', {
        p_org_id: org.id
      });

      if (error) throw error;
      toast.success("Empresa restaurada com sucesso!");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar empresa.");
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      const { error } = await supabase.rpc('operator_toggle_user_status', {
        p_user_id: userId,
        p_ativo: newStatus
      });
      
      if (error) throw error;
      toast.success(newStatus ? "Usuário desbloqueado." : "Usuário bloqueado com sucesso.");
      
      // Update local state
      setSelectedOrgUsers(prev => prev.map(u => u.id === userId ? { ...u, ativo: newStatus } : u));
    } catch (err) {
      toast.error("Erro ao alterar status do usuário.");
      console.error(err);
    }
  };

  const handleResetPassword = async (email) => {
    if(!email) return toast.error("Usuário sem e-mail cadastrado.");
    if(!confirm(`Enviar link de redefinição de senha para ${email}?`)) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/nova-senha',
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado!");
    } catch (err) {
      toast.error("Erro ao enviar e-mail de recuperação.");
      console.error(err);
    }
  };

  const filteredUsers = selectedOrgUsers.filter(user => {
    const term = userSearchTerm.toLowerCase();
    return (
      (user.nome?.toLowerCase().includes(term)) ||
      (user.email?.toLowerCase().includes(term)) ||
      (user.cargo?.toLowerCase().includes(term)) ||
      (user.matricula?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Empresas (Tenants)</h1>
        <p className="text-slate-600 mt-1">Visualize telemetria e controle o acesso de todas as empresas clientes.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Carregando empresas...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Organização</th>
                  <th className="px-4 py-3">Plano Atual</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Usuários Ativos</th>
                  <th className="px-4 py-3 text-right">Tráfego (Eventos)</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.map(org => {
                  const plano = planos.find(p => p.id === org.plano_id);
                  const usage = usageData[org.id] || { active_users: 0, total_events: 0 };
                  
                  return (
                    <tr key={org.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {org.name}
                      </td>
                      <td className="px-4 py-3">
                        {plano ? plano.nome : <span className="text-slate-400">Sem Plano</span>}
                      </td>
                      <td className="px-4 py-3">
                        {org.deleted_at ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Exclusão Agendada
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            org.status_assinatura === 'ativa' ? 'bg-emerald-100 text-emerald-800' :
                            org.status_assinatura === 'cancelada' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {org.status_assinatura || 'inativa'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">
                        {usage.active_users}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-mono">
                        {usage.total_events}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Ações da Empresa</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetailsModal(org)}>
                              <FileText className="w-4 h-4 mr-2" /> Ficha Completa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openOrgFootstepsModal(org)}>
                              <Activity className="w-4 h-4 mr-2 text-blue-600" /> Feed de Atividades
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAccessModal(org)}>
                              <Key className="w-4 h-4 mr-2 text-indigo-600" /> Gerenciar Acessos
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openOverrideModal(org)}>
                              <ShieldAlert className="w-4 h-4 mr-2 text-amber-600" /> Override de Plano
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {org.deleted_at ? (
                              <DropdownMenuItem onClick={() => handleRestoreCompany(org)} className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50">
                                <Activity className="w-4 h-4 mr-2" /> Restaurar Empresa
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onClick={() => handleCancelPlan(org)}>
                                  <XCircle className="w-4 h-4 mr-2 text-orange-600" /> Finalizar Plano
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDeleteModal(org)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Empresa
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">Nenhuma empresa encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Override Modal */}
      <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-800">
              <ShieldAlert className="w-5 h-5" /> Override de Assinatura
            </DialogTitle>
            <DialogDescription>
              Alterar forçadamente a assinatura de <strong>{selectedOrg?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOverrideSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Novo Plano</label>
              <select
                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-amber-500 focus:ring-amber-500"
                value={overridePlanId}
                onChange={(e) => setOverridePlanId(e.target.value)}
              >
                <option value="">-- Remover Plano --</option>
                {planos.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Motivo (Obrigatório para Auditoria)</label>
              <textarea
                required
                className="w-full border-slate-300 rounded-lg shadow-sm focus:border-amber-500 focus:ring-amber-500"
                rows="3"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ex: Concessão especial, correção de cobrança, etc."
              />
            </div>

            <DialogFooter>
              <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg" onClick={() => setIsOverrideModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={isOverriding} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                {isOverriding ? "Aplicando..." : "Confirmar Override"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Excluir Empresa
            </DialogTitle>
            <DialogDescription>
              Você está prestes a excluir a empresa <strong>{selectedOrg?.name}</strong>.
              A empresa entrará na Lixeira (Agendada para Exclusão) e perderá o acesso imediato ao sistema.
              Após 90 dias, todos os dados serão apagados permanentemente de forma automática.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </button>
            <button type="button" onClick={handleDeleteCompany} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              {isDeleting ? "Agendando..." : "Mover para Lixeira (90 dias)"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-500" /> Ficha da Empresa: {selectedOrg?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-semibold">ID do Tenant</p>
                <p className="text-sm font-mono text-slate-900 mt-1">{selectedOrg?.id}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-semibold">Data de Criação</p>
                <p className="text-sm text-slate-900 mt-1">{new Date(selectedOrg?.created_at).toLocaleDateString()}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-semibold">Cliente Asaas ID</p>
                <p className="text-sm font-mono text-slate-900 mt-1">{selectedOrg?.asaas_customer_id || 'Não vinculado'}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-semibold">Assinatura Asaas ID</p>
                <p className="text-sm font-mono text-slate-900 mt-1">{selectedOrg?.asaas_subscription_id || 'Não vinculado'}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Módulos Ativos (Configurações)</p>
              <pre className="text-xs bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(selectedOrg?.organization_settings?.[0]?.modulos_ativos || {}, null, 2)}
              </pre>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Users className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-blue-600 uppercase font-semibold">Usuários Ativos</p>
                  <p className="text-xl font-bold text-blue-900">{usageData[selectedOrg?.id]?.active_users || 0}</p>
                </div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Activity className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-emerald-600 uppercase font-semibold">Tráfego (Eventos)</p>
                  <p className="text-xl font-bold text-emerald-900">{usageData[selectedOrg?.id]?.total_events || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg" onClick={() => setIsDetailsModalOpen(false)}>
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Acessos */}
      <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" /> Gerenciar Acessos: {selectedOrg?.name}
            </DialogTitle>
            <DialogDescription>
              Visualize, bloqueie ou envie redefinição de senhas para todos os usuários que têm acesso a este painel.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou cargo..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="pl-9 w-full border-slate-200 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 mt-4 overflow-x-auto overflow-y-auto max-h-[60vh]">
            {loadingUsers ? (
              <div className="p-8 text-center text-slate-500">Carregando acessos...</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Nome / Cargo</th>
                    <th className="px-4 py-3">Matrícula</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Último Login</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{user.nome}</div>
                        <div className="text-xs text-slate-500">{user.cargo || 'Sem cargo'}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {user.matricula || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3">
                        {user.ativo ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Ativo</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Bloqueado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {user.ultimo_login ? new Date(user.ultimo_login).toLocaleString() : 'Nunca acessou'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => {
                              setActiveFootstepsUser(user);
                              setIsFootstepsModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-200 rounded text-emerald-600" 
                            title="Ver Pegadas (Footsteps)"
                          >
                            <Footprints className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleResetPassword(user.email)}
                            className="p-1.5 hover:bg-slate-200 rounded text-slate-600 tooltip-trigger" 
                            title="Enviar E-mail de Recuperação de Senha"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToggleUserStatus(user.id, user.ativo)}
                            className={`p-1.5 rounded transition-colors ${user.ativo ? 'hover:bg-red-100 text-red-600' : 'hover:bg-emerald-100 text-emerald-600'}`}
                            title={user.ativo ? "Bloquear Acesso" : "Desbloquear Acesso"}
                          >
                            {user.ativo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="mt-4">
            <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg" onClick={() => setIsAccessModalOpen(false)}>
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Pegadas (Telemetria) */}
      <Dialog open={isFootstepsModalOpen} onOpenChange={setIsFootstepsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Footprints className="w-5 h-5 text-emerald-600" />
              Pegadas de: {activeFootstepsUser?.nome}
            </DialogTitle>
            <DialogDescription>
              Últimos passos e cliques deste usuário no sistema em tempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {!activeFootstepsUser?.last_footsteps || activeFootstepsUser.last_footsteps.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Nenhuma atividade registrada recentemente.</p>
            ) : (
              <div className="relative border-l border-slate-200 ml-3 pl-4 space-y-4">
                {activeFootstepsUser.last_footsteps.map((step, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white" />
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-slate-900">{step.action}</p>
                      <span className="text-xs text-slate-400 font-mono mt-0.5">{step.path}</span>
                      <span className="text-[10px] text-slate-500 mt-1">
                        {new Date(step.timestamp).toLocaleDateString()} às {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <button 
              type="button" 
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg" 
              onClick={() => setIsFootstepsModalOpen(false)}
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Feed de Atividades da Organização */}
      <Dialog open={isOrgFootstepsModalOpen} onOpenChange={setIsOrgFootstepsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Feed de Atividades: {selectedOrg?.name}
            </DialogTitle>
            <DialogDescription>
              Linha do tempo consolidada com as últimas ações de todos os usuários desta empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {loadingOrgFootsteps ? (
              <div className="p-8 text-center text-slate-500">Carregando feed de atividades...</div>
            ) : orgFootsteps.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Nenhuma atividade recente registrada nesta empresa.</div>
            ) : (
              <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                {orgFootsteps.map((step, idx) => (
                  <div key={idx} className="relative bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
                    <span className="absolute -left-[31px] top-4 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 ring-4 ring-white" />
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{step.action}</p>
                        <span className="text-xs text-slate-500">
                          {new Date(step.timestamp).toLocaleDateString()} às {new Date(step.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono mt-1">{step.path}</span>
                      <div className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {step.userName ? step.userName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="text-xs font-medium text-slate-700">{step.userName || 'Usuário Desconhecido'}</span>
                        <span className="text-xs text-slate-400">({step.userEmail || 'Sem email'})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <button 
              type="button" 
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg" 
              onClick={() => setIsOrgFootstepsModalOpen(false)}
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
