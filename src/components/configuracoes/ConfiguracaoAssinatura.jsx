import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { 
  Check, 
  Loader2, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Trash2, 
  ExternalLink, 
  ShieldCheck,
  RefreshCw,
  Copy,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import EscolhaPlano from "./EscolhaPlano";
import PlanModulesDisplay from "@/components/planos/PlanModulesDisplay";


export default function ConfiguracaoAssinatura() {
  const { organization, refreshTenant } = useTenant();
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [loadingPending, setLoadingPending] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Load available plans from DB
  useEffect(() => {
    async function loadPlanos() {
      try {
        setLoadingPlanos(true);
        const { data, error } = await supabase
          .from("planos")
          .select("*")
          .eq("ativo", true)
          .order("preco_mensal", { ascending: true });

        if (error) throw error;
        setPlanos(data || []);
      } catch (err) {
        console.error("Erro ao carregar planos:", err);
        toast.error("Erro ao carregar os planos do sistema.");
      } finally {
        setLoadingPlanos(false);
      }
    }

    loadPlanos();
  }, []);

  // Fetch pending invoice details if subscription status is 'processando' or 'atrasada'
  useEffect(() => {
    if (organization?.status_assinatura === "processando" || organization?.status_assinatura === "atrasada") {
      fetchPendingPaymentDetails();
    } else {
      setPendingPayment(null);
    }
  }, [organization?.status_assinatura, organization?.asaas_subscription_id]);

  const fetchPendingPaymentDetails = async () => {
    if (!organization?.asaas_subscription_id) return;
    
    try {
      setLoadingPending(true);
      const { data, error } = await supabase.functions.invoke("criar-assinatura", {
        body: { action: "get-pending-payment" }
      });

      if (error) {
        let msg = error.message || 'Erro ao buscar cobrança pendente.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }
      if (data && data.paymentId) {
        setPendingPayment(data);
      } else {
        setPendingPayment(null);
      }
    } catch (err) {
      console.error("Erro ao buscar cobrança pendente:", err);
    } finally {
      setLoadingPending(false);
    }
  };



  const handleCancelSubscription = async () => {
    try {
      setLoadingSubmit(true);
      const { data, error } = await supabase.functions.invoke("criar-assinatura", {
        body: { action: "cancel" }
      });

      if (error) {
        let msg = error.message || 'Erro ao solicitar o cancelamento.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }

      if (data?.success) {
        toast.success("Assinatura cancelada com sucesso.");
        setShowCancelModal(false);
        await refreshTenant();
      }
    } catch (err) {
      console.error("Erro ao cancelar assinatura:", err);
      toast.error(err.message || "Erro ao solicitar o cancelamento.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const [isCancelingPending, setIsCancelingPending] = useState(false);
  const handleCancelPending = async () => {
    if (!confirm("Tem certeza que deseja cancelar esta fatura? Você poderá escolher o plano e a forma de pagamento novamente.")) return;
    
    try {
      setIsCancelingPending(true);
      const { data, error } = await supabase.functions.invoke("criar-assinatura", {
        body: { action: "cancel-and-restart" }
      });
      
      if (error) throw error;
      
      toast.success("Fatura cancelada com sucesso. Escolha seu plano novamente.");
      await refreshTenant();
      setShowPlanSelection(true);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cancelar a fatura.");
    } finally {
      setIsCancelingPending(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Helper to translate status
  const getStatusBadge = (status) => {
    switch (status) {
      case "ativa":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><ShieldCheck className="w-3.5 h-3.5" /> Ativa</span>;
      case "atrasada":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800"><AlertTriangle className="w-3.5 h-3.5" /> Em Atraso</span>;
      case "processando":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando Pagamento</span>;
      case "cancelada":
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Cancelada</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">Sem Assinatura</span>;
    }
  };

  const isSubscribed = organization?.status_assinatura && organization.status_assinatura !== "sem_assinatura" && organization.status_assinatura !== "cancelada";
  const currentPlan = planos.find(p => p.id === organization?.plano_id);

  const isDefaultOrg = organization?.id === '00000000-0000-0000-0000-000000000001' || organization?.slug === 'moveis-pedro-ii';

  if (isDefaultOrg) {
    return (
      <Card className="border-green-100 shadow-sm max-w-2xl mx-auto">
        <CardHeader className="bg-green-50/50 text-center">
          <CardTitle className="text-xl flex items-center justify-center gap-2" style={{ color: "#07593f" }}>
            <ShieldCheck className="w-6 h-6 text-green-700" />
            Organização Matriz
          </CardTitle>
          <CardDescription className="text-green-800 font-medium">
            Esta organização ({organization?.name || "Matriz"}) possui licença corporativa vitalícia.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-gray-600 text-sm">
            Como esta é a conta mestre do sistema, o faturamento e cobranças recorrentes são gerenciados diretamente pelo time operacional do ERP. Não há ações financeiras pendentes para o seu domínio.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            Acesso Ilimitado & Isento
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loadingPlanos) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-700 mb-2" />
        <p className="text-sm text-gray-500">Carregando planos e informações de assinatura...</p>
      </div>
    );
  }
  if (!isSubscribed || showPlanSelection) {
    return <EscolhaPlano onCancel={isSubscribed ? () => setShowPlanSelection(false) : null} />;
  }

  return (
    <div className="space-y-6">
      
      {/* 1. SE ASSINATURA ESTÁ EM ATRASO OU PROCESSANDO */}
      {isSubscribed && organization?.status_assinatura === "atrasada" && (
        <Alert className="border-2 border-red-200 bg-red-50 text-red-900">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertTitle className="font-bold text-red-800">Sua fatura recorrente está vencida!</AlertTitle>
          <AlertDescription className="mt-1">
            Detectamos que o pagamento da sua última mensalidade está atrasado. 
            Você possui um período de <strong>carência de 3 dias</strong> para regularizar o pagamento antes que os módulos pagos (WhatsApp Bot e Fotos de Entrega) sejam suspensos temporariamente.
          </AlertDescription>
        </Alert>
      )}

      {/* 2. PORTAL DE FATURAMENTO (SE JÁ TEM ASSINATURA) */}
      {isSubscribed ? (
        <div className="space-y-6">
          <Card className="border-green-100 shadow-sm">
            <CardHeader className="bg-green-50/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2" style={{ color: "#07593f" }}>
                    <Sparkles className="w-5 h-5 text-green-600" />
                    Plano de Assinatura Ativo
                  </CardTitle>
                  <CardDescription>
                    Gerencie seu plano atual, formas de pagamento e cancelamento.
                  </CardDescription>
                </div>
                <div>
                  {getStatusBadge(organization?.status_assinatura)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Plano Contratado</span>
                  <p className="text-lg font-bold text-gray-800">{currentPlan?.nome || "Carregando..."}</p>
                  <p className="text-2xl font-extrabold text-green-800 mt-1">
                    {currentPlan ? formatCurrency(currentPlan.preco_mensal) : "R$ --"}
                    <span className="text-xs font-normal text-gray-500"> / mês</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Próxima Cobrança</span>
                  <p className="text-lg font-semibold text-gray-800">
                    {organization?.proxima_cobranca 
                      ? new Date(organization.proxima_cobranca + "T12:00:00").toLocaleDateString("pt-BR")
                      : "Sem data agendada"
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Cobrança processada automaticamente via Asaas.</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">ID da Assinatura</span>
                  <p className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded select-all max-w-max">
                    {organization?.asaas_subscription_id}
                  </p>
                  <button 
                    onClick={fetchPendingPaymentDetails}
                    className="text-xs text-green-700 hover:text-green-800 flex items-center gap-1 font-semibold mt-2 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPending ? "animate-spin" : ""}`} />
                    Atualizar Status
                  </button>
                </div>
              </div>

              {/* Módulos Habilitados no Plano Atual */}
              {currentPlan?.recursos && (
                <div className="mt-8 border-t pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Módulos Habilitados por este Plano:</h4>
                  <PlanModulesDisplay recursos={currentPlan.recursos} variant="card" />
                </div>
              )}

            </CardContent>
            
            <CardFooter className="bg-gray-50/50 border-t py-4 px-6 flex flex-wrap justify-between gap-4">
              <Button 
                variant="outline"
                className="text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-800 transition-colors"
                onClick={() => setShowCancelModal(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancelar Assinatura
              </Button>
              
              <Button 
                onClick={() => {
                  // Upgrade / Downgrade is just selecting another plan
                  setPendingPayment(null);
                  setShowPlanSelection(true);
                }}
                className="bg-green-700 hover:bg-green-800 transition-colors"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Trocar de Plano (Upgrade/Downgrade)
              </Button>
            </CardFooter>
          </Card>

          {/* MOSTRAR QR CODE / BOLETO SE HOUVER COBRANÇA PENDENTE */}
          {(organization?.status_assinatura === "processando" || organization?.status_assinatura === "atrasada") && (
            <Card className="border-amber-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-amber-50">
                <CardTitle className="text-base text-amber-800 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Instruções para Pagamento da Fatura
                </CardTitle>
                <CardDescription className="text-amber-700">
                  Efetue o pagamento abaixo para liberar ou manter o acesso aos seus módulos do plano {currentPlan?.nome}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingPending ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600 mr-2" />
                    <p className="text-sm text-gray-500">Buscando faturas geradas no Asaas...</p>
                  </div>
                ) : pendingPayment ? (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                      
                      {/* PIX QR CODE SHOWING */}
                      {pendingPayment.pixQrCode && (
                        <div className="flex flex-col items-center p-4 bg-white border rounded-xl shadow-inner shrink-0">
                          <img 
                            src={`data:image/png;base64,${pendingPayment.pixQrCode}`} 
                            alt="QR Code Pix"
                            className="w-40 h-40 object-contain"
                          />
                          <span className="text-xs text-gray-400 mt-2">Escaneie com o app do banco</span>
                        </div>
                      )}

                      {/* PAYMENT DETAILS COLUMN */}
                      <div className="flex-1 space-y-4 w-full">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-xs text-gray-400 font-semibold block">Valor do Pagamento</span>
                            <span className="text-lg font-bold text-gray-800">{formatCurrency(pendingPayment.value)}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 font-semibold block">Data de Vencimento</span>
                            <span className="text-lg font-bold text-gray-800">
                              {new Date(pendingPayment.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-wrap gap-3 pt-2">
                          {pendingPayment.pixCopiaCola && (
                            <Button 
                              variant="outline"
                              onClick={() => copyToClipboard(pendingPayment.pixCopiaCola)}
                              className="text-gray-700"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Copiar Pix Copia e Cola
                            </Button>
                          )}

                          {pendingPayment.bankSlipUrl && (
                            <Button 
                              variant="outline"
                              onClick={() => window.open(pendingPayment.bankSlipUrl, "_blank")}
                              className="text-gray-700"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Visualizar Boleto (PDF)
                            </Button>
                          )}

                          {pendingPayment.invoiceUrl && (
                            <Button 
                              variant="outline"
                              onClick={() => window.open(pendingPayment.invoiceUrl, "_blank")}
                              className="text-gray-700"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Abrir Fatura Asaas
                            </Button>
                          )}

                          <Button 
                            variant="outline"
                            onClick={() => {
                              setPendingPayment(null);
                              setShowPlanSelection(true);
                            }}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Alterar Plano
                          </Button>

                          <Button 
                            variant="outline"
                            onClick={handleCancelPending}
                            disabled={isCancelingPending}
                            className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                          >
                            {isCancelingPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Cancelar Fatura Atual
                          </Button>
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    Nenhuma fatura em aberto foi localizada no painel do Asaas. 
                    A assinatura está sendo processada, se já realizou o pagamento o acesso será liberado em breve.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}



      {/* 5. MODAL DE CANCELAMENTO */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Cancelar sua Assinatura?
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-2">
              Tem certeza que deseja cancelar sua assinatura recorrente? Ao cancelar, as cobranças do Asaas serão encerradas.
              <br /><br />
              <strong className="text-red-700">Atenção:</strong> O acesso aos módulos <strong>WhatsApp Bot</strong> e <strong>Fotos de Entrega</strong> será bloqueado permanentemente assim que a exclusão for efetuada no Asaas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={loadingSubmit}
            >
              Manter Assinatura
            </Button>
            <Button
              onClick={handleCancelSubscription}
              disabled={loadingSubmit}
              className="bg-rose-700 hover:bg-rose-800 hover:text-white"
            >
              {loadingSubmit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                "Sim, Cancelar Plano"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
