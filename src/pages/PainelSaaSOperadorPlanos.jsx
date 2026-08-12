import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
  Loader2, 
  Edit, 
  Plus, 
  Trash2, 
  LayoutGrid, 
  Table, 
  Sparkles, 
  Check, 
  Layers, 
  HelpCircle,
  ExternalLink,
  MessageCircle,
  Eye,
  CheckCircle2,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SYSTEM_MODULES, MODULE_CATEGORIES } from "@/config/modules";
import PlanModulesDisplay from "@/components/planos/PlanModulesDisplay";

export default function PainelSaaSOperadorPlanos() {
  const [loading, setLoading] = useState(true);
  const [planos, setPlanos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState("cards"); // 'cards' | 'table'

  // Edit/Create Plan State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [modalTab, setModalTab] = useState("design"); // 'design' | 'modules' | 'sync'
  const [isEditing, setIsEditing] = useState(false);

  const [planForm, setPlanForm] = useState({
    id: null,
    nome: "",
    preco_mensal: "",
    sem_valor: false,
    descricao: "",
    destaque: false,
    badge: "",
    botao_texto: "Comece Agora",
    botao_link: "",
    beneficios: [
      "Acesso via web em qualquer dispositivo",
      "Suporte especializado via WhatsApp",
      "Backups automáticos diários",
      "Módulos de PDV, Estoque e Logística"
    ],
    ativo: true,
    recursos: {},
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
      setPlanos(planosData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Falha ao carregar planos do sistema.");
    } finally {
      setLoading(false);
    }
  }

  // Módulos iniciais
  const getInitialPlanModules = (planoRecursos = {}) => {
    const map = {};
    SYSTEM_MODULES.forEach(mod => {
      if (Object.prototype.hasOwnProperty.call(planoRecursos, mod.key)) {
        map[mod.key] = planoRecursos[mod.key] !== false;
      } else {
        map[mod.key] = true;
      }
    });
    return map;
  };

  const handleOpenCreatePlan = () => {
    setIsEditing(false);
    setModalTab("design");
    setPlanForm({
      id: null,
      nome: "",
      preco_mensal: "",
      sem_valor: false,
      descricao: "",
      destaque: false,
      badge: "",
      botao_texto: "Comece Agora",
      botao_link: "",
      beneficios: [
        "Acesso via web em qualquer dispositivo",
        "Suporte especializado via WhatsApp",
        "Backups automáticos diários",
        "Módulos de PDV, Estoque e Logística"
      ],
      ativo: true,
      recursos: getInitialPlanModules({}),
      updateExisting: false,
      updateExistingModules: false
    });
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plano) => {
    setIsEditing(true);
    setModalTab("design");
    const isCustom = !plano.preco_mensal || Number(plano.preco_mensal) === 0 || plano.recursos?.customizado || plano.recursos?.sob_consulta;
    
    const existingBeneficios = Array.isArray(plano.recursos?.beneficios) && plano.recursos.beneficios.length > 0
      ? plano.recursos.beneficios
      : (isCustom ? [
          "Módulos e recursos sob demanda",
          "Suporte prioritário e especializado",
          "Backups automáticos diários",
          "Implantação e onboarding dedicado"
        ] : [
          "Acesso via web em qualquer dispositivo",
          "Suporte especializado via WhatsApp",
          "Backups automáticos diários",
          "Módulos de PDV, Estoque e Logística"
        ]);

    setPlanForm({
      id: plano.id,
      nome: plano.nome || "",
      preco_mensal: isCustom ? "" : (plano.preco_mensal ?? "").toString(),
      sem_valor: !!isCustom,
      ordem: plano.recursos?.ordem ?? "",
      descricao: plano.recursos?.descricao || plano.descricao || (isCustom ? "Solução sob medida para o tamanho e fluxo da sua operação." : "Acesso completo aos módulos e recursos do GestApp."),
      destaque: !!plano.recursos?.destaque,
      badge: plano.recursos?.badge || plano.nome || "",
      botao_texto: plano.recursos?.botao_texto || (isCustom ? "Contate-nos" : "Comece Agora"),
      botao_link: plano.recursos?.botao_link || "",
      beneficios: existingBeneficios,
      ativo: plano.ativo ?? true,
      recursos: getInitialPlanModules(plano.recursos || {}),
      updateExisting: false,
      updateExistingModules: false
    });
    setShowPlanModal(true);
  };

  const handleToggleAtivo = async (plano) => {
    try {
      const novoStatus = !plano.ativo;
      const body = {
        action: 'update',
        planId: plano.id,
        nome: plano.nome,
        preco_mensal: plano.preco_mensal,
        ativo: novoStatus,
        recursos: plano.recursos || {}
      };

      const { data, error } = await supabase.functions.invoke('operator-update-plan', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(novoStatus ? `Plano "${plano.nome}" agora está VISÍVEL na Landing Page!` : `Plano "${plano.nome}" foi OCULTADO da Landing Page.`);
      fetchData();
    } catch (err) {
      console.error("Erro ao alterar visibilidade:", err);
      toast.error(err.message || "Erro ao alterar visibilidade do plano.");
    }
  };

  const togglePlanModule = (moduleKey) => {
    setPlanForm(prev => ({
      ...prev,
      recursos: {
        ...prev.recursos,
        [moduleKey]: !prev.recursos?.[moduleKey]
      }
    }));
  };

  // Funções de edição de Benefícios (Checklist)
  const handleAddBeneficio = () => {
    setPlanForm(prev => ({
      ...prev,
      beneficios: [...prev.beneficios, ""]
    }));
  };

  const handleUpdateBeneficio = (index, value) => {
    setPlanForm(prev => {
      const updated = [...prev.beneficios];
      updated[index] = value;
      return { ...prev, beneficios: updated };
    });
  };

  const handleRemoveBeneficio = (index) => {
    setPlanForm(prev => ({
      ...prev,
      beneficios: prev.beneficios.filter((_, i) => i !== index)
    }));
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      const isCustom = !!planForm.sem_valor;
      let parsedPrice = 0;

      if (!isCustom) {
        parsedPrice = parseFloat(planForm.preco_mensal.toString().replace(',', '.'));
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          throw new Error("Por favor, informe um preço mensal válido.");
        }
      }

      const filteredBeneficios = (planForm.beneficios || []).filter(b => typeof b === 'string' && b.trim().length > 0);

      const updatedRecursos = {
        ...planForm.recursos,
        descricao: planForm.descricao,
        destaque: !!planForm.destaque,
        badge: planForm.badge || planForm.nome,
        ordem: planForm.ordem !== "" ? Number(planForm.ordem) : undefined,
        botao_texto: planForm.botao_texto || (isCustom ? "Contate-nos" : "Comece Agora"),
        botao_link: planForm.botao_link,
        beneficios: filteredBeneficios,
        customizado: isCustom,
        sob_consulta: isCustom
      };

      const body = {
        action: isEditing ? 'update' : 'create',
        nome: planForm.nome,
        preco_mensal: parsedPrice,
        ativo: planForm.ativo,
        recursos: updatedRecursos
      };

      if (isEditing) {
        body.planId = planForm.id;
        body.update_existing = isCustom ? false : planForm.updateExisting;
        body.update_existing_modules = planForm.updateExistingModules;
      }

      const { data, error } = await supabase.functions.invoke('operator-update-plan', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Plano e Card salvos com sucesso!");
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

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Gestão de Planos & Cards da Landing Page
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Edite em tempo real os títulos, preços, descrições, botões e benefícios exibidos nos cards do site.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenCreatePlan} className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm cursor-pointer">
            <Plus className="w-4 h-4 mr-1.5" /> Novo Plano / Card
          </Button>
        </div>
      </div>

      {/* Seletor de Modo de Visualização */}
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveViewTab("cards")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeViewTab === "cards"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
            Visualização dos Cards (Landing Page)
          </button>
          <button
            onClick={() => setActiveViewTab("table")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeViewTab === "table"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Table className="w-4 h-4 text-slate-600" />
            Tabela Técnica & Módulos
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {planos.length} plano(s) configurado(s)
        </span>
      </div>

      {/* ABA 1: VISUALIZAÇÃO DOS CARDS (COMO APARECEM NA LANDING PAGE) */}
      {activeViewTab === "cards" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planos.map((plano, index) => {
              const isCustom = !plano.preco_mensal || Number(plano.preco_mensal) === 0 || plano.recursos?.customizado || plano.recursos?.sob_consulta;
              const isPopular = plano.recursos?.destaque !== undefined ? !!plano.recursos.destaque : (index === 1);
              const descricao = plano.recursos?.descricao || plano.descricao || (isCustom ? "Solução sob medida para o tamanho e fluxo da sua operação." : "Acesso completo aos módulos e recursos do GestApp.");
              const botaoTexto = plano.recursos?.botao_texto || (isCustom ? "Contate-nos" : "Comece Agora");
              
              const defaultBeneficios = isCustom ? [
                "Módulos e recursos sob demanda",
                "Suporte prioritário e especializado",
                "Backups automáticos diários",
                "Implantação e onboarding dedicado"
              ] : [
                "Acesso via web em qualquer dispositivo",
                "Suporte especializado via WhatsApp",
                "Backups automáticos diários",
                "Módulos de PDV, Estoque e Logística"
              ];

              const beneficios = Array.isArray(plano.recursos?.beneficios) && plano.recursos.beneficios.length > 0
                ? plano.recursos.beneficios
                : defaultBeneficios;

              return (
                <div 
                  key={plano.id} 
                  className={`bg-white rounded-[2rem] p-5 border transition-all duration-300 flex flex-col justify-between relative group ${
                    isPopular 
                      ? "border-emerald-300 shadow-[0_15px_45px_rgba(45,122,77,0.08)] ring-2 ring-emerald-500/10" 
                      : "border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03)] hover:shadow-md"
                  }`}
                >
                  <div className="space-y-5">
                    {/* Header do Card */}
                    <div className={`rounded-2xl p-5 transition-colors ${
                      isPopular 
                        ? "bg-[#e7f4ed] border border-[#ccebd5]" 
                        : "bg-slate-100/70 border border-slate-200/50"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block px-3 py-1 bg-white text-slate-800 text-[11px] font-bold rounded-full tracking-wider uppercase shadow-2xs">
                          {plano.recursos?.badge || plano.nome}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {isPopular && (
                            <span className="text-[10px] font-bold text-[#2d7a4d] uppercase tracking-wider mr-1">
                              Mais Escolhido
                            </span>
                          )}
                          
                          {/* Botão de 1 Clique para Exibir / Ocultar da Landing Page */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleAtivo(plano);
                            }}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                              plano.ativo
                                ? "bg-emerald-600 hover:bg-red-600 text-white"
                                : "bg-gray-200 hover:bg-emerald-600 text-gray-700 hover:text-white"
                            }`}
                            title={plano.ativo ? "Atualmente VISÍVEL no site. Clique para Ocultar." : "Atualmente OCULTO do site. Clique para Exibir."}
                          >
                            {plano.ativo ? (
                              <>
                                <Eye className="w-3 h-3" />
                                Visível no Site
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                Oculto do Site
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Preço */}
                      <div className="mt-5 flex items-baseline gap-1">
                        {isCustom ? (
                          <>
                            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                              Sob Consulta
                            </span>
                            <span className="text-xs font-semibold text-slate-500">/personalizado</span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                              {formatCurrency(plano.preco_mensal)}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">/mês</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Descrição */}
                    <p className="text-xs sm:text-sm font-medium text-slate-700 px-1 min-h-[36px] leading-relaxed">
                      {descricao}
                    </p>

                    {/* Botão de Demonstração */}
                    <div className="px-1">
                      <button className="w-full py-3 bg-[#1b2a23] text-white text-xs font-semibold rounded-full shadow-xs opacity-95">
                        {botaoTexto}
                      </button>
                    </div>

                    {/* Checklist de Benefícios */}
                    <div className="pt-2 px-1 space-y-2.5 text-xs text-slate-600 border-t border-slate-100">
                      {beneficios.map((item, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2.5">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="leading-tight">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Barra de Ações Rápidas no Rodapé do Card */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleOpenEditPlan(plano)} 
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5" /> Editar Conteúdo do Card
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600 hover:bg-red-50 border-slate-200 rounded-xl px-3 cursor-pointer"
                      onClick={() => {
                        setPlanToDelete(plano);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABA 2: VISUALIZAÇÃO EM TABELA TÉCNICA */}
      {activeViewTab === "table" && (
        <Card className="border-slate-200/80 shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg">Planos do Sistema & Módulos Inclusos</CardTitle>
            <CardDescription>Visão tabular de preços, permissões de módulos e assinaturas.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b uppercase">
                  <tr>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3">Preço Mensal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Destaque Site</th>
                    <th className="px-4 py-3">Módulos Inclusos</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {planos.map(plano => {
                    const isCustom = !plano.preco_mensal || Number(plano.preco_mensal) === 0 || plano.recursos?.customizado || plano.recursos?.sob_consulta;
                    return (
                      <tr key={plano.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{plano.nome}</td>
                        <td className="px-4 py-3">
                          {isCustom ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Sob Consulta
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(plano.preco_mensal)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {plano.ativo ? (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-md">Ativo</span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-md">Inativo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {plano.recursos?.destaque ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              ★ Mais Escolhido
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Padrão</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <PlanModulesDisplay recursos={plano.recursos} variant="compact" showDisabled={false} />
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL INTUITIVO DE EDIÇÃO / CRIAÇÃO DO CARD E PLANO */}
      {/* ========================================================================= */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handlePlanSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg">
                {isEditing ? <Edit className="w-5 h-5 text-emerald-700" /> : <Plus className="w-5 h-5 text-emerald-700" />}
                {isEditing ? `Editar Plano & Card: ${planForm.nome || "Novo"}` : "Criar Novo Plano / Card"}
              </DialogTitle>
              <DialogDescription>
                Personalize os dados de apresentação do card na Landing Page e configure os módulos do sistema.
              </DialogDescription>
            </DialogHeader>

            {/* Abas Internas do Modal */}
            <Tabs value={modalTab} onValueChange={setModalTab} className="mt-4">
              <TabsList className="grid grid-cols-3 w-full bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="design" className="text-xs font-semibold">
                  🎨 Conteúdo do Card
                </TabsTrigger>
                <TabsTrigger value="modules" className="text-xs font-semibold">
                  ⚙️ Módulos ERP
                </TabsTrigger>
                <TabsTrigger value="sync" className="text-xs font-semibold">
                  🔄 Propagação
                </TabsTrigger>
              </TabsList>

              {/* ABA 1: CONTEÚDO DO CARD NA LANDING PAGE */}
              <TabsContent value="design" className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="planName" className="text-xs font-bold text-slate-700">Nome do Plano</Label>
                    <Input
                      id="planName"
                      value={planForm.nome}
                      onChange={(e) => setPlanForm({...planForm, nome: e.target.value})}
                      placeholder="Ex: Starter, Enterprise..."
                      required
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="planBadge" className="text-xs font-bold text-slate-700">Tag / Badge do Topo</Label>
                    <Input
                      id="planBadge"
                      value={planForm.badge}
                      onChange={(e) => setPlanForm({...planForm, badge: e.target.value})}
                      placeholder="Ex: STARTER, POPULAR..."
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-1">
                    <Label htmlFor="planOrdem" className="text-xs font-bold text-slate-700">Posição no Site (1, 2, 3)</Label>
                    <Input
                      id="planOrdem"
                      type="number"
                      min="1"
                      value={planForm.ordem}
                      onChange={(e) => setPlanForm({...planForm, ordem: e.target.value})}
                      placeholder="Ex: 1 para 1º card"
                    />
                  </div>
                </div>

                {/* Box de Preço & Customizado */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="planSemValor" 
                      checked={planForm.sem_valor}
                      onCheckedChange={(c) => setPlanForm({
                        ...planForm, 
                        sem_valor: !!c, 
                        preco_mensal: !!c ? "" : planForm.preco_mensal,
                        botao_texto: !!c ? "Contate-nos" : (planForm.botao_texto === "Contate-nos" ? "Comece Agora" : planForm.botao_texto)
                      })}
                    />
                    <label htmlFor="planSemValor" className="text-sm font-semibold text-slate-800 cursor-pointer">
                      Plano Customizado (Sob Consulta / Sem valor fixo)
                    </label>
                  </div>

                  {planForm.sem_valor ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 leading-relaxed">
                      <p className="font-semibold">✓ Modo Sob Consulta ativado:</p>
                      <p className="text-blue-700 mt-0.5">
                        O card exibirá <strong>"Sob Consulta / personalizado"</strong> e o botão <strong>"Contate-nos"</strong> direcionará o cliente para atendimento comercial.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="planPrice" className="text-xs font-bold text-slate-700">Preço Mensal (R$)</Label>
                      <Input
                        id="planPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={planForm.preco_mensal}
                        onChange={(e) => setPlanForm({...planForm, preco_mensal: e.target.value})}
                        placeholder="Ex: 299.90"
                        required={!planForm.sem_valor}
                      />
                    </div>
                  )}
                </div>

                {/* Descrição Curta */}
                <div className="space-y-1.5">
                  <Label htmlFor="planDesc" className="text-xs font-bold text-slate-700">Descrição Curta do Card</Label>
                  <Input
                    id="planDesc"
                    value={planForm.descricao}
                    onChange={(e) => setPlanForm({...planForm, descricao: e.target.value})}
                    placeholder="Ex: Ideal para pequenos comércios e lojas em fase de crescimento."
                  />
                </div>

                {/* Destaque e Botão */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="btnTexto" className="text-xs font-bold text-slate-700">Texto do Botão</Label>
                    <Input
                      id="btnTexto"
                      value={planForm.botao_texto}
                      onChange={(e) => setPlanForm({...planForm, botao_texto: e.target.value})}
                      placeholder="Ex: Comece Agora ou Contate-nos"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="btnLink" className="text-xs font-bold text-slate-700">Link Personalizado (Opcional)</Label>
                    <Input
                      id="btnLink"
                      value={planForm.botao_link}
                      onChange={(e) => setPlanForm({...planForm, botao_link: e.target.value})}
                      placeholder="Ex: https://wa.me/55... ou /cadastro"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="planDestaque" 
                      checked={planForm.destaque}
                      onCheckedChange={(c) => setPlanForm({...planForm, destaque: !!c})}
                    />
                    <label htmlFor="planDestaque" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Destacar este Plano (Fundo verde com tag "Mais Escolhido")
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="planActive" 
                      checked={planForm.ativo}
                      onCheckedChange={(c) => setPlanForm({...planForm, ativo: !!c})}
                    />
                    <label htmlFor="planActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Plano Ativo no Site
                    </label>
                  </div>
                </div>

                {/* EDITOR DE BENEFÍCIOS (CHECKLIST) */}
                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Linhas de Benefícios exibidas no Card (Checklist)
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddBeneficio}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300 h-7"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Linha
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {planForm.beneficios.map((beneficio, bIndex) => (
                      <div key={bIndex} className="flex items-center gap-2">
                        <Input
                          value={beneficio}
                          onChange={(e) => handleUpdateBeneficio(bIndex, e.target.value)}
                          placeholder={`Benefício #${bIndex + 1}`}
                          className="text-xs h-8"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveBeneficio(bIndex)}
                          className="text-red-500 hover:text-red-700 h-8 w-8 p-0 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* ABA 2: MÓDULOS DO SISTEMA ERP */}
              <TabsContent value="modules" className="space-y-4 pt-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                  Selecione quais módulos do GestApp ficam desbloqueados para as empresas que assinarem este plano.
                </div>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {MODULE_CATEGORIES.map(cat => {
                    const categoryModules = SYSTEM_MODULES.filter(m => m.category === cat.key);
                    return (
                      <div key={cat.key} className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                        <p className="text-[11px] uppercase font-bold text-slate-600 tracking-wider">{cat.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {categoryModules.map(mod => {
                            const isChecked = planForm.recursos?.[mod.key] !== false;
                            return (
                              <div key={mod.key} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-100">
                                <Checkbox
                                  id={`plan_mod_${mod.key}`}
                                  checked={isChecked}
                                  onCheckedChange={() => togglePlanModule(mod.key)}
                                />
                                <label htmlFor={`plan_mod_${mod.key}`} className="text-xs font-medium cursor-pointer text-slate-700">
                                  {mod.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              {/* ABA 3: SINCRONIZAÇÃO E PROPAGAÇÃO */}
              <TabsContent value="sync" className="space-y-4 pt-4">
                {isEditing ? (
                  <div className="flex flex-col gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                      Propagação para Empresas Ativas
                    </p>
                    <div className="flex items-start space-x-2 pt-1">
                      <Checkbox 
                        id="updateExistingPrice" 
                        className="mt-1"
                        checked={planForm.updateExisting}
                        disabled={planForm.sem_valor}
                        onCheckedChange={(c) => setPlanForm({...planForm, updateExisting: !!c})}
                      />
                      <label htmlFor="updateExistingPrice" className="text-xs font-medium text-blue-900 cursor-pointer leading-relaxed">
                        Propagar NOVO PREÇO para a próxima fatura do Asaas das empresas ativas neste plano
                      </label>
                    </div>
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="updateExistingModules" 
                        className="mt-1"
                        checked={planForm.updateExistingModules}
                        onCheckedChange={(c) => setPlanForm({...planForm, updateExistingModules: !!c})}
                      />
                      <label htmlFor="updateExistingModules" className="text-xs font-medium text-blue-900 cursor-pointer leading-relaxed">
                        Propagar NOVOS MÓDULOS para as empresas ativas neste plano
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500">
                    Ao criar um novo plano, novas empresas cadastradas receberão as configurações definidas.
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => setShowPlanModal(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold cursor-pointer">
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar Card & Plano
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Excluir Plano</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o plano <strong>{planToDelete?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-slate-600 leading-relaxed">
            A exclusão só será permitida se nenhuma organização estiver vinculada a este plano.
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
