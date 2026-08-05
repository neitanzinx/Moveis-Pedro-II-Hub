import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { 
  Check, 
  Loader2, 
  CreditCard, 
  QrCode, 
  FileText, 
  Sparkles, 
  ChevronRight,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PlanModulesDisplay from "@/components/planos/PlanModulesDisplay";


export default function EscolhaPlano({ onCancel }) {
  const { organization, refreshTenant } = useTenant();
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  
  // Checkout flow state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("PIX"); // PIX, BOLETO, CREDIT_CARD
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Credit Card Form fields
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  
  // Additional Cardholder Billing details
  const [holderCpfCnpj, setHolderCpfCnpj] = useState(organization?.cnpj || "");
  const [holderEmail, setHolderEmail] = useState(organization?.email_suporte || "");
  const [holderPhone, setHolderPhone] = useState(organization?.whatsapp_suporte || "");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("1");

  const isSubscribed = organization?.status_assinatura && organization.status_assinatura !== "sem_assinatura" && organization.status_assinatura !== "cancelada";

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

  const handleSelectPlan = (plano) => {
    setSelectedPlan(plano);
    setHolderCpfCnpj(organization?.cnpj || "");
    setHolderEmail(organization?.email_suporte || "");
    setHolderPhone(organization?.whatsapp_suporte || "");
    setShowPaymentModal(true);
  };

  const handleConfirmSubscription = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    // Validar dados de faturamento para todas as formas de pagamento
    const cleanCpfCnpj = holderCpfCnpj.replace(/\D/g, "");
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      toast.error("CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.");
      return;
    }
    if (!holderEmail || !holderEmail.includes("@")) {
      toast.error("E-mail de faturamento inválido.");
      return;
    }
    if (!holderPhone || holderPhone.replace(/\D/g, "").length < 10) {
      toast.error("WhatsApp / Telefone inválido (mínimo 10 dígitos).");
      return;
    }

    if (paymentMethod === "CREDIT_CARD") {
      if (!cardHolderName || !cardNumber || !cardExpiryMonth || !cardExpiryYear || !cardCvv) {
        toast.error("Preencha todos os campos do cartão de crédito.");
        return;
      }
      if (!holderPostalCode) {
        toast.error("CEP é obrigatório para pagamento com cartão.");
        return;
      }
    }

    try {
      setLoadingSubmit(true);
      
      const payload = {
        planoId: selectedPlan.id,
        paymentMethod,
        billingInfo: {
          cnpj: cleanCpfCnpj,
          email: holderEmail.trim(),
          phone: holderPhone.replace(/\D/g, "")
        },
        cardDetails: paymentMethod === "CREDIT_CARD" ? {
          holderName: cardHolderName,
          number: cardNumber,
          expiryMonth: cardExpiryMonth,
          expiryYear: cardExpiryYear,
          ccv: cardCvv,
          email: holderEmail,
          cpfCnpj: holderCpfCnpj,
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
          phone: holderPhone
        } : null
      };

      const { data, error } = await supabase.functions.invoke("criar-assinatura", {
        body: payload
      });

      if (error) {
        let msg = error.message || 'Ocorreu um erro ao processar a assinatura.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }

      if (data?.success) {
        toast.success("Solicitação de assinatura registrada!");
        setShowPaymentModal(false);
        await refreshTenant(); 
        if (onCancel) onCancel();
      }
    } catch (err) {
      console.error("Erro ao assinar plano:", err);
      toast.error(err.message || "Ocorreu um erro ao processar a assinatura no Asaas.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  if (loadingPlanos) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-700 mb-2" />
        <p className="text-sm text-gray-500">Carregando planos disponíveis...</p>
      </div>
    );
  }

  return (
    <div id="planos-selection-section" className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-t pt-6 flex justify-between items-end">
        <div>
          <h3 className="text-lg font-bold text-gray-800" style={{ color: "#07593f" }}>
            Nossos Planos Disponíveis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Selecione um plano diferente abaixo para realizar o upgrade ou downgrade da sua assinatura atual.
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} className="mb-1">
            Voltar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:max-w-4xl mx-auto">
        {planos.map((plano) => {
          const isCurrent = plano.id === organization?.plano_id && organization?.status_assinatura === 'ativa';
          
          return (
            <Card 
              key={plano.id} 
              className={`flex flex-col h-full transition-all relative ${
                isCurrent 
                  ? "border-2 border-green-700 shadow-md ring-1 ring-green-700/20" 
                  : "hover:shadow-md border-gray-200"
              }`}
            >
              {plano.slug === "profissional" && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-green-700 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                  Mais Popular
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl text-gray-800">{plano.nome}</CardTitle>
                <CardDescription className="text-xs mt-1">Recorrência mensal automática</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-gray-900">{formatCurrency(plano.preco_mensal)}</span>
                  <span className="text-sm text-gray-400"> / mês</span>
                </div>
              </CardHeader>
              
              <CardContent className="flex-grow pt-2">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
                    <Sparkles className="w-4 h-4 text-green-700" /> Módulos Habilitados:
                  </div>
                  <PlanModulesDisplay recursos={plano.recursos} variant="card" />

                  <div className="flex items-start gap-2 text-sm text-gray-500 pt-2 border-t text-xs">
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                    <span>Inclui suporte técnico e atualizações do MPII Hub.</span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="pt-6">
                {isCurrent ? (
                  <Button className="w-full bg-green-50 text-green-800 border border-green-200 cursor-default hover:bg-green-50" disabled>
                    Plano Atual Contratado
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleSelectPlan(plano)}
                    className="w-full bg-green-700 hover:bg-green-800 transition-colors"
                  >
                    {plano.id === organization?.plano_id 
                      ? "Confirmar e Gerar Cobrança" 
                      : (isSubscribed ? "Alterar para este Plano" : "Assinar este Plano")}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* MODAL DE CONFIRMAÇÃO E PAGAMENTO (PIX/BOLETO/CARD) */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleConfirmSubscription} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold" style={{ color: "#07593f" }}>
                Confirmar Assinatura — {selectedPlan?.nome}
              </DialogTitle>
              <DialogDescription>
                Selecione a forma de pagamento recorrente. A primeira cobrança será gerada hoje e as mensalidades serão automáticas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Label className="font-semibold text-gray-700">Forma de Pagamento Recorrente</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("PIX")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                    paymentMethod === "PIX" 
                      ? "border-green-700 bg-green-50 text-green-800 ring-2 ring-green-700/20" 
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <QrCode className="w-5 h-5 mb-1.5" />
                  PIX
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("BOLETO")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                    paymentMethod === "BOLETO" 
                      ? "border-green-700 bg-green-50 text-green-800 ring-2 ring-green-700/20" 
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <FileText className="w-5 h-5 mb-1.5" />
                  Boleto
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("CREDIT_CARD")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                    paymentMethod === "CREDIT_CARD" 
                      ? "border-green-700 bg-green-50 text-green-800 ring-2 ring-green-700/20" 
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <CreditCard className="w-5 h-5 mb-1.5" />
                  Cartão
                </button>
              </div>
            </div>

            {paymentMethod === "CREDIT_CARD" && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-green-700" />
                  Dados do Cartão de Crédito
                </h4>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="card-name" className="text-xs font-semibold text-gray-500">Nome Impresso no Cartão</Label>
                    <Input 
                      id="card-name"
                      placeholder="NOME DO TITULAR"
                      value={cardHolderName}
                      onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="card-number" className="text-xs font-semibold text-gray-500">Número do Cartão</Label>
                    <Input 
                      id="card-number"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").substring(0, 16))}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="card-month" className="text-xs font-semibold text-gray-500">Mês Exp.</Label>
                      <Input 
                        id="card-month"
                        placeholder="MM"
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value.replace(/\D/g, "").substring(0, 2))}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-year" className="text-xs font-semibold text-gray-500">Ano Exp.</Label>
                      <Input 
                        id="card-year"
                        placeholder="AAAA"
                        value={cardExpiryYear}
                        onChange={(e) => setCardExpiryYear(e.target.value.replace(/\D/g, "").substring(0, 4))}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="card-cvv" className="text-xs font-semibold text-gray-500">CVV</Label>
                      <Input 
                        id="card-cvv"
                        placeholder="123"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").substring(0, 4))}
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dados de Faturamento (Sempre Visíveis) */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-bold text-gray-700">Dados de Faturamento</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="billing-cnpj" className="text-xs font-semibold text-gray-500">CPF ou CNPJ</Label>
                  <Input 
                    id="billing-cnpj"
                    placeholder="Apenas números"
                    value={holderCpfCnpj}
                    onChange={(e) => setHolderCpfCnpj(e.target.value.replace(/\D/g, ""))}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="billing-email" className="text-xs font-semibold text-gray-500">E-mail para Recibo / Faturas</Label>
                  <Input 
                    id="billing-email"
                    type="email"
                    placeholder="email@provedor.com"
                    value={holderEmail}
                    onChange={(e) => setHolderEmail(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div className={paymentMethod === "CREDIT_CARD" ? "" : "col-span-2"}>
                  <Label htmlFor="billing-phone" className="text-xs font-semibold text-gray-500">WhatsApp / Telefone</Label>
                  <Input 
                    id="billing-phone"
                    placeholder="Ex: 24999999999"
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(e.target.value.replace(/\D/g, ""))}
                    className="mt-1"
                    required
                  />
                </div>
                {paymentMethod === "CREDIT_CARD" && (
                  <>
                    <div>
                      <Label htmlFor="billing-cep" className="text-xs font-semibold text-gray-500">CEP Residencial</Label>
                      <Input 
                        id="billing-cep"
                        placeholder="00000-000"
                        value={holderPostalCode}
                        onChange={(e) => setHolderPostalCode(e.target.value.replace(/\D/g, "").substring(0, 8))}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="billing-num" className="text-xs font-semibold text-gray-500">Número Residência</Label>
                      <Input 
                        id="billing-num"
                        placeholder="Ex: 123"
                        value={holderAddressNumber}
                        onChange={(e) => setHolderAddressNumber(e.target.value)}
                        className="mt-1"
                        required
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                disabled={loadingSubmit}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loadingSubmit}
                className="bg-green-700 hover:bg-green-800 transition-colors"
              >
                {loadingSubmit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  "Confirmar e Pagar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
