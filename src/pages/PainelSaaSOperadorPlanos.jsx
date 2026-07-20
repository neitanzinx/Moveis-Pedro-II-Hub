import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Edit, Save, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function PainelSaaSOperadorPlanos() {
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit/Create Plan State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // false = creating
  const [planForm, setPlanForm] = useState({
    id: null,
    nome: "",
    preco_mensal: "",
    ativo: true,
    recursos: { whatsapp_bot: false, fotos_entrega: false },
    updateExisting: false,
    updateExistingModules: false
  });

  // Delete State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      const { data: planosData, error: planosError } = await supabase
        .from("planos")
        .select("*")
        .order("preco_mensal", { ascending: true });
        
      if (planosError) throw planosError;
        
      if (planosError) throw planosError;
      setPlanos(planosData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar planos e organizações.");
    } finally {
      setLoading(false);
    }
  }

  // Ações de Plano
  const handleOpenCreatePlan = () => {
    setIsEditing(false);
    setPlanForm({
      id: null,
      nome: "",
      preco_mensal: "",
      ativo: true,
      recursos: { whatsapp_bot: false, fotos_entrega: false },
      updateExisting: false,
      updateExistingModules: false
    });
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plano) => {
    setIsEditing(true);
    setPlanForm({
      id: plano.id,
      nome: plano.nome,
      preco_mensal: plano.preco_mensal.toString(),
      ativo: plano.ativo,
      recursos: {
        whatsapp_bot: !!plano.recursos?.whatsapp_bot,
        fotos_entrega: !!plano.recursos?.fotos_entrega
      },
      updateExisting: false,
      updateExistingModules: false
    });
    setShowPlanModal(true);
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const body = {
        action: isEditing ? 'update' : 'create',
        nome: planForm.nome,
        preco_mensal: parseFloat(planForm.preco_mensal.replace(',', '.')),
        ativo: planForm.ativo,
        recursos: planForm.recursos
      };

      if (isEditing) {
        body.planId = planForm.id;
        body.update_existing = planForm.updateExisting;
        body.update_existing_modules = planForm.updateExistingModules;
      }

      const { data, error } = await supabase.functions.invoke('operator-update-plan', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Plano salvo com sucesso!");
      if (data?.asaas_stats?.success > 0 || data?.asaas_stats?.errors > 0) {
         toast.info(`Atualizações no Asaas: ${data.asaas_stats?.success} sucessos, ${data.asaas_stats?.errors} erros.`);
      }

      setShowPlanModal(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao salvar plano:", error);
      toast.error(error.message || "Erro ao salvar plano.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke('operator-update-plan', {
        body: { action: 'delete', planId: planToDelete.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Plano excluído com sucesso.");
      setShowDeleteModal(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error(error.message || "Falha ao excluir plano.");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlanModule = (mod) => {
    setPlanForm(prev => ({
      ...prev,
      recursos: { ...prev.recursos, [mod]: !prev.recursos[mod] }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestão de Planos & Assinaturas</h1>
          <p className="text-slate-500 mt-1">
            Crie, edite planos e altere manualmente assinaturas de organizações (Override).
          </p>
        </div>
        <Button onClick={handleOpenCreatePlan} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Planos do Sistema</CardTitle>
            <CardDescription>Planos disponíveis para novas assinaturas e legados.</CardDescription>
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
                    <th className="px-4 py-3 text-right">Ações</th>
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
                          <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Ativo</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">Legado</span>
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
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-900" onClick={() => handleOpenEditPlan(plano)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => {
                          setPlanToDelete(plano);
                          setShowDeleteModal(true);
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Modal de Criar/Editar Plano */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-md">
          <form onSubmit={handlePlanSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isEditing ? <Edit className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
                {isEditing ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? "Atualize os detalhes e recursos do plano." : "Preencha os detalhes para criar um novo plano."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="planName">Nome do Plano</Label>
                <Input
                  id="planName"
                  value={planForm.nome}
                  onChange={(e) => setPlanForm({...planForm, nome: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="planPrice">Preço Mensal (R$)</Label>
                <Input
                  id="planPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.preco_mensal}
                  onChange={(e) => setPlanForm({...planForm, preco_mensal: e.target.value})}
                  required
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="planActive" 
                  checked={planForm.ativo}
                  onCheckedChange={(c) => setPlanForm({...planForm, ativo: !!c})}
                />
                <label htmlFor="planActive" className="text-sm font-medium leading-none cursor-pointer">
                  Plano Ativo (Disponível para novas assinaturas)
                </label>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Módulos Inclusos neste Plano</Label>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="p_wpp" checked={planForm.recursos.whatsapp_bot} onCheckedChange={() => togglePlanModule('whatsapp_bot')} />
                    <label htmlFor="p_wpp" className="text-sm">WhatsApp Bot</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="p_fotos" checked={planForm.recursos.fotos_entrega} onCheckedChange={() => togglePlanModule('fotos_entrega')} />
                    <label htmlFor="p_fotos" className="text-sm">Fotos de Entrega</label>
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="space-y-2 pt-4 border-t mt-4">
                  <div className="flex flex-col gap-3 bg-blue-50 p-3 rounded-md border border-blue-100">
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="updateExistingPrice" 
                        className="mt-1"
                        checked={planForm.updateExisting}
                        onCheckedChange={(c) => setPlanForm({...planForm, updateExisting: !!c})}
                      />
                      <label htmlFor="updateExistingPrice" className="text-sm font-medium text-blue-900 cursor-pointer">
                        Propagar NOVO PREÇO para a próxima fatura das empresas ativas
                      </label>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="updateExistingModules" 
                        className="mt-1"
                        checked={planForm.updateExistingModules}
                        onCheckedChange={(c) => setPlanForm({...planForm, updateExistingModules: !!c})}
                      />
                      <label htmlFor="updateExistingModules" className="text-sm font-medium text-blue-900 cursor-pointer">
                        Propagar NOVOS MÓDULOS para as empresas ativas neste plano
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPlanModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Excluir Plano</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o plano <strong>{planToDelete?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600">
            A exclusão só será permitida se não existirem organizações atreladas a este plano. Caso existam, inative-o.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeletePlan} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
