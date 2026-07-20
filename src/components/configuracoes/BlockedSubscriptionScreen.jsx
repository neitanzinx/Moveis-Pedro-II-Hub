import React, { useState, useEffect } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import EscolhaPlano from './EscolhaPlano';
import {
  CreditCard, QrCode, FileText, Loader2, LogOut,
  AlertTriangle, CheckCircle, Clock, Copy, ExternalLink, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

export default function BlockedSubscriptionScreen() {
  const { organization, refreshTenant } = useTenant();
  const { logout } = useAuth();
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);

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
        if (['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(data.status)) {
          toast.success("Pagamento confirmado! Seu acesso foi liberado.");
          await refreshTenant();
          return;
        }
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

  useEffect(() => {
    fetchPendingPaymentDetails();
  }, [organization?.asaas_subscription_id]);

  const handleRefreshStatus = async () => {
    try {
      setCheckingStatus(true);
      await refreshTenant();
      toast.success("Status atualizado!");
    } catch (err) {
      toast.error("Erro ao atualizar o status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  const [isCanceling, setIsCanceling] = useState(false);
  
  const handleCancelPending = async () => {
    if (!confirm("Tem certeza que deseja cancelar esta fatura? Você poderá escolher o plano e a forma de pagamento novamente.")) return;
    
    try {
      setIsCanceling(true);
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
      setIsCanceling(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado com sucesso!");
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  // Obter detalhes de layout com base no status real da assinatura
  const getStatusInfo = () => {
    switch (organization?.status_assinatura) {
      case 'processando':
        return {
          title: "Assinatura Pendente de Pagamento",
          description: "O pagamento da sua assinatura ainda não foi confirmado pelo Asaas.",
          icon: <Clock className="w-12 h-12 text-amber-500" />,
          bgColor: "bg-amber-50 dark:bg-amber-950/20",
          textColor: "text-amber-800 dark:text-amber-400",
          borderColor: "border-amber-200 dark:border-amber-900/30"
        };
      case 'atrasada':
        return {
          title: "Assinatura Vencida / Atrasada",
          description: "Detectamos atraso no pagamento da sua assinatura e o acesso ao painel foi suspenso.",
          icon: <AlertTriangle className="w-12 h-12 text-rose-500" />,
          bgColor: "bg-rose-50 dark:bg-rose-950/20",
          textColor: "text-rose-800 dark:text-rose-400",
          borderColor: "border-rose-200 dark:border-rose-900/30"
        };
      case 'cancelada':
        return {
          title: "Assinatura Cancelada",
          description: "A assinatura da sua empresa foi cancelada. Entre em contato com o suporte para reativar.",
          icon: <AlertTriangle className="w-12 h-12 text-gray-500" />,
          bgColor: "bg-gray-50 dark:bg-gray-800/20",
          textColor: "text-gray-800 dark:text-gray-400",
          borderColor: "border-gray-200 dark:border-gray-700/30"
        };
      default:
        return {
          title: "Acesso Bloqueado",
          description: "Não identificamos uma assinatura ativa para esta organização.",
          icon: <AlertTriangle className="w-12 h-12 text-amber-500" />,
          bgColor: "bg-amber-50 dark:bg-amber-950/20",
          textColor: "text-amber-800 dark:text-amber-400",
          borderColor: "border-amber-200 dark:border-amber-900/30"
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (showPlanSelection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 p-6 rounded-2xl border shadow-lg">
          <EscolhaPlano onCancel={() => setShowPlanSelection(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Card className={`border shadow-lg ${statusInfo.borderColor}`}>
          <CardHeader className={`flex flex-col items-center text-center p-6 rounded-t-xl ${statusInfo.bgColor}`}>
            <div className="mb-4">
              {statusInfo.icon}
            </div>
            <CardTitle className={`text-2xl font-bold ${statusInfo.textColor}`}>
              {statusInfo.title}
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 max-w-md mt-2">
              {statusInfo.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            <div className="text-sm border rounded-xl p-4 bg-white dark:bg-neutral-900 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Organização:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{organization?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CNPJ:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">{organization?.cnpj || 'Não cadastrado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status atual:</span>
                <span className="capitalize font-semibold text-gray-800 dark:text-gray-200">
                  {organization?.status_assinatura?.replace('_', ' ') || 'Pendente'}
                </span>
              </div>
            </div>

            {loadingPending ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-green-700 mb-2" />
                <p className="text-sm text-gray-500">Carregando detalhes do pagamento...</p>
              </div>
            ) : pendingPayment ? (
              <Card className="border-green-100 dark:border-green-900/30 shadow-inner">
                <CardHeader className="p-4 bg-green-50/50 dark:bg-green-900/10">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-800 dark:text-green-400">
                    <QrCode className="w-4 h-4" /> Dados para Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {pendingPayment.status && !['PENDING', 'OVERDUE'].includes(pendingPayment.status) && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-200 dark:border-red-800">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p>
                        Atenção: O status atual do pagamento é <strong>{pendingPayment.status}</strong>. 
                        Isso pode indicar que o pagamento foi recusado ou falhou. Considere cancelar a fatura atual e tentar novamente.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {pendingPayment.pixQrCode && (
                      <div className="flex flex-col items-center p-3 bg-white border rounded-xl shadow-inner shrink-0">
                        <img 
                          src={`data:image/png;base64,${pendingPayment.pixQrCode}`} 
                          alt="QR Code Pix"
                          className="w-36 h-36 object-contain"
                        />
                        <span className="text-[10px] text-gray-400 mt-1">Escaneie no App do banco</span>
                      </div>
                    )}
                    
                    <div className="flex-1 w-full space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-xs text-gray-400 font-semibold block">Valor da Fatura</span>
                          <span className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(pendingPayment.value)}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-400 font-semibold block">Vencimento</span>
                          <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                            {new Date(pendingPayment.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {pendingPayment.pixCopiaCola && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(pendingPayment.pixCopiaCola)}
                            className="text-gray-700 hover:bg-gray-100"
                          >
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Copia e Cola
                          </Button>
                        )}

                        {pendingPayment.bankSlipUrl && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(pendingPayment.bankSlipUrl, "_blank")}
                            className="text-gray-700 hover:bg-gray-100"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            Ver Boleto
                          </Button>
                        )}

                        {pendingPayment.invoiceUrl && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(pendingPayment.invoiceUrl, "_blank")}
                            className="text-gray-700 hover:bg-gray-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Abrir Fatura
                          </Button>
                        )}

                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPlanSelection(true)}
                          className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                          Alterar Plano
                        </Button>

                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={handleCancelPending}
                          disabled={isCanceling}
                          className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                        >
                          {isCanceling ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}
                          Cancelar Fatura Atual
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              organization?.status_assinatura !== 'cancelada' && (
                <div className="text-center py-6 px-4 space-y-4 text-gray-500 text-sm border border-dashed rounded-xl bg-gray-50/50">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Nenhuma cobrança ativa pendente encontrada no Asaas.</p>
                    <p className="text-xs text-gray-400">Isso pode ocorrer se os dados de faturamento (como CNPJ/CPF) estiverem incorretos ou se a assinatura não pôde ser gerada no Asaas.</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPlanSelection(true)}
                    className="border-green-700 text-green-700 hover:bg-green-50 hover:text-green-800"
                  >
                    Configurar Assinatura / Corrigir CNPJ
                  </Button>
                </div>
              )
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 border-t p-6 bg-gray-50/50 dark:bg-neutral-900/50 rounded-b-xl">
            <Button
              onClick={handleRefreshStatus}
              disabled={checkingStatus}
              className="w-full sm:flex-1 bg-green-700 hover:bg-green-800 text-white font-medium shadow"
            >
              {checkingStatus ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" /> Já efetuei o pagamento / Atualizar</>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={logout}
              className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
