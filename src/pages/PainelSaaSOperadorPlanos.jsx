import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Edit, Save, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function PainelSaaSOperadorPlanos() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [planos, setPlanos] = useState([]);
  
  // Override State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [overridePlanId, setOverridePlanId] = useState("");
  const [overrideModules, setOverrideModules] = useState({ whatsapp_bot: false, fotos_entrega: false });
  const [overrideMotivo, setOverrideMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Fetch Planos
      const { data: planosData, error: planosError } = await supabase
        .from("planos")
        .select("*")
        .order("preco_mensal", { ascending: true });
        
      if (planosError) throw planosError;
      setPlanos(planosData || []);

      // Fetch Organizations with their settings
      const { data: orgsData, error: orgsError } = await supabase
        .from("organizations")
        .select(`
          id, 
          nome, 
          plano_id, 
          status_assinatura,
          organization_settings (
            modulos_ativos
          )
        `);
        
      if (orgsError) throw orgsError;
      
      const formattedOrgs = orgsData?.map(org => ({
        ...org,
        modulos_ativos: org.organization_settings?.[0]?.modulos_ativos || {}
      })) || [];
      
      setOrganizations(formattedOrgs);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar planos e organizações.");
    } finally {
      setLoading(false);
    }
  }

  const handleOpenOverride = (org) => {
    setSelectedOrg(org);
    setOverridePlanId(org.plano_id || "");
    setOverrideModules(org.modulos_ativos || { whatsapp_bot: false, fotos_entrega: false });
    setOverrideMotivo("");
    setShowOverrideModal(true);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    
    if (!overrideMotivo.trim()) {
      toast.error("O motivo é obrigatório para registrar a auditoria.");
      return;
    }
    if (!overridePlanId) {
      toast.error("Selecione um plano.");
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase.rpc('operator_override_subscription', {
        p_org_id: selectedOrg.id,
        p_plano_id: overridePlanId,
        p_modulos: overrideModules,
        p_motivo: overrideMotivo
      });

      if (error) throw error;
      
      toast.success("Assinatura alterada com sucesso!");
      setShowOverrideModal(false);
      fetchData();
    } catch (error) {
      console.error("Erro no override:", error);
      toast.error(error.message || "Erro ao realizar override da assinatura.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleModule = (moduleName) => {
    setOverrideModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestão de Planos & Assinaturas</h1>
        <p className="text-slate-500 mt-1">
          Visão geral de planos e administração forçada de assinaturas (Override Manual).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Tabela de Planos (Apenas Leitura / Visão Geral) */}
        <Card>
          <CardHeader>
            <CardTitle>Planos do Sistema</CardTitle>
            <CardDescription>Planos disponíveis e legados no sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b uppercase">
                  <tr>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Preço Mensal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Módulos Inclusos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {planos.map(plano => (
                    <tr key={plano.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">{plano.nome}</td>
                      <td className="px-4 py-3">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.preco_mensal)}
                      </td>
                      <td className="px-4 py-3">
                        {plano.ativo ? (
                          <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">
                            Legado (Inativo)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {plano.recursos && Object.entries(plano.recursos)
                            .filter(([_, ativo]) => ativo)
                            .map(([key]) => (
                              <span key={key} className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 capitalize">
                                {key.replace("_", " ")}
                              </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Gestão de Assinaturas (Tenants) */}
        <Card>
          <CardHeader>
            <CardTitle>Tenants & Overrides</CardTitle>
            <CardDescription>Altere planos e módulos ativos manualmente. Essa ação é auditada.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b uppercase">
                  <tr>
                    <th className="px-4 py-3">Organização</th>
                    <th className="px-4 py-3">Plano Atual</th>
                    <th className="px-4 py-3">Status Financeiro</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {organizations.map(org => {
                    const plano = planos.find(p => p.id === org.plano_id);
                    return (
                      <tr key={org.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">{org.nome}</td>
                        <td className="px-4 py-3">
                          {plano ? plano.nome : <span className="text-slate-400">Sem Plano</span>}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {org.status_assinatura.replace("_", " ")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                            onClick={() => handleOpenOverride(org)}
                          >
                            <ShieldAlert className="w-4 h-4 mr-2" />
                            Override
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Override */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleOverrideSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-800">
                <ShieldAlert className="w-5 h-5" />
                Override de Assinatura
              </DialogTitle>
              <DialogDescription>
                Alterar forçadamente a assinatura de <strong>{selectedOrg?.nome}</strong>. Esta ação será registrada no log de auditoria.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="plano">Novo Plano</Label>
                <select 
                  id="plano"
                  className="w-full p-2 border rounded-md text-sm bg-white"
                  value={overridePlanId}
                  onChange={(e) => setOverridePlanId(e.target.value)}
                  required
                >
                  <option value="" disabled>Selecione um plano</option>
                  {planos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} {p.ativo ? "" : "(Legado)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Módulos Ativos (Override)</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mod_wpp" 
                      checked={!!overrideModules.whatsapp_bot}
                      onCheckedChange={() => toggleModule('whatsapp_bot')}
                    />
                    <label htmlFor="mod_wpp" className="text-sm font-medium leading-none cursor-pointer">
                      WhatsApp Bot
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mod_fotos" 
                      checked={!!overrideModules.fotos_entrega}
                      onCheckedChange={() => toggleModule('fotos_entrega')}
                    />
                    <label htmlFor="mod_fotos" className="text-sm font-medium leading-none cursor-pointer">
                      Fotos de Entrega
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="motivo">Motivo (Obrigatório)</Label>
                <Input
                  id="motivo"
                  placeholder="Ex: Correção de bug no faturamento, cortesia..."
                  value={overrideMotivo}
                  onChange={(e) => setOverrideMotivo(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOverrideModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-amber-700 hover:bg-amber-800">
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Aplicar Override
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
