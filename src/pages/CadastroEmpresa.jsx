import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Building2, User, CreditCard, QrCode, FileText, Check, ChevronRight,
  ChevronLeft, Loader2, Sparkles, Info, Eye, EyeOff, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  { id: 1, title: "Escolha o Plano", icon: Sparkles },
  { id: 2, title: "Dados da Empresa", icon: Building2 },
  { id: 3, title: "Pagamento", icon: CreditCard },
];

export default function CadastroEmpresa() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1 — Plan selection
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Step 2 — Company data
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [whatsappEmpresa, setWhatsappEmpresa] = useState("");
  const [nomeAdmin, setNomeAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error } = await supabase.storage.from('publico').upload(fileName, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('publico').getPublicUrl(fileName);
      setLogoUrl(publicUrl);
      toast.success("Logo enviada com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar logo:", err);
      toast.error("Erro ao enviar a logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Step 3 — Payment
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("1");

  // Result
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadPlanos();
  }, []);

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
      toast.error("Erro ao carregar os planos.");
    } finally {
      setLoadingPlanos(false);
    }
  }

  const formatCurrency = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatCnpj = (value) => {
    const nums = value.replace(/\D/g, "").substring(0, 14);
    return nums
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const formatPhone = (value) => {
    const nums = value.replace(/\D/g, "").substring(0, 11);
    if (nums.length <= 10) {
      return nums.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    }
    return nums.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  };

  const validateStep2 = () => {
    if (!nomeEmpresa.trim()) { toast.error("Nome da empresa é obrigatório."); return false; }
    if (cnpj.replace(/\D/g, "").length < 11) { toast.error("CNPJ/CPF inválido."); return false; }
    if (!emailEmpresa.includes("@")) { toast.error("Email da empresa inválido."); return false; }
    if (!nomeAdmin.trim()) { toast.error("Nome do responsável é obrigatório."); return false; }
    if (!emailAdmin.includes("@")) { toast.error("Email do administrador inválido."); return false; }
    if (senhaAdmin.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres."); return false; }
    return true;
  };

  const handleSubmit = async () => {
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
      setSubmitting(true);

      const payload = {
        nomeEmpresa: nomeEmpresa.trim(),
        cnpj: cnpj.replace(/\D/g, ""),
        emailEmpresa: emailEmpresa.trim(),
        whatsappEmpresa: whatsappEmpresa ? whatsappEmpresa.replace(/\D/g, "") : null,
        logoUrl: logoUrl || null,
        nomeAdmin: nomeAdmin.trim(),
        emailAdmin: emailAdmin.trim(),
        senhaAdmin,
        planoId: selectedPlan.id,
        paymentMethod,
        cardDetails: paymentMethod === "CREDIT_CARD" ? {
          holderName: cardHolderName,
          number: cardNumber,
          expiryMonth: cardExpiryMonth,
          expiryYear: cardExpiryYear,
          ccv: cardCvv,
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
        } : null
      };

      const { data, error } = await supabase.functions.invoke("criar-organizacao", {
        body: payload
      });

      if (error) {
        let msg = error.message || 'Erro ao processar o cadastro.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            if (body?.error) msg = body.error;
          } catch (_) {}
        }
        throw new Error(msg);
      }

      if (data?.success) {
        setResult(data);
        setStep(4); // Success screen
        toast.success("Cadastro realizado com sucesso!");
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error("Erro no cadastro:", err);
      toast.error(err.message || "Erro ao processar o cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginRedirect = async () => {
    // Auto-login com as credenciais recém-criadas
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailAdmin,
        password: senhaAdmin
      });
      if (error) throw error;
      navigate("/admin", { replace: true });
    } catch {
      navigate("/login", { replace: true });
    }
  };

  // ========== STEPPER VISUAL ==========
  const renderStepper = () => (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = step === s.id;
        const isDone = step > s.id;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <div className={`w-12 h-0.5 mx-1 transition-colors ${isDone ? "bg-green-600" : "bg-gray-200"}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isActive ? "bg-green-700 text-white shadow-lg ring-4 ring-green-100" :
                isDone ? "bg-green-600 text-white" :
                "bg-gray-100 text-gray-400"
              }`}>
                {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap ${
                isActive ? "text-green-800" : isDone ? "text-green-600" : "text-gray-400"
              }`}>{s.title}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ========== STEP 1: PLANOS ==========
  const renderStepPlanos = () => (
    <div key="step-1" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Escolha o plano ideal para sua empresa</h2>
        <p className="text-gray-500 mt-2">Todos os planos incluem o sistema ERP completo. A diferença está nos módulos extras.</p>
      </div>

      {loadingPlanos ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-green-700" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {planos.map((plano) => {
            const isSelected = selectedPlan?.id === plano.id;
            return (
              <Card
                key={plano.id}
                className={`cursor-pointer transition-all relative ${
                  isSelected
                    ? "border-2 border-green-700 shadow-lg ring-2 ring-green-100"
                    : "border-gray-200 hover:shadow-md hover:border-green-300"
                }`}
                onClick={() => setSelectedPlan(plano)}
              >
                {plano.slug === "completo" && (
                  <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-green-700 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                    Recomendado
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl text-gray-800">{plano.nome}</CardTitle>
                  <CardDescription className="text-xs">Recorrência mensal automática</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold text-gray-900">{formatCurrency(plano.preco_mensal)}</span>
                    <span className="text-sm text-gray-400"> / mês</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 border-b pb-2">
                      <Sparkles className="w-4 h-4 text-green-700" /> Módulos Inclusos:
                    </div>
                    {plano.recursos && Object.entries(plano.recursos).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 text-sm text-gray-600">
                        {val ? (
                          <Check className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <span className="w-4 h-4 text-gray-300 font-bold shrink-0 text-center">-</span>
                        )}
                        <span className="capitalize">{key.replace("_", " ")}</span>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 text-xs text-gray-500 pt-2 border-t">
                      <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <span>Inclui suporte técnico e atualizações do MPII Hub.</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  {isSelected ? (
                    <Button className="w-full bg-green-700 hover:bg-green-800" disabled>
                      <Check className="w-4 h-4 mr-2" /> Selecionado
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full border-green-200 text-green-800 hover:bg-green-50">
                      Selecionar
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ========== STEP 2: DADOS DA EMPRESA ==========
  const renderStepDadosEmpresa = () => (
    <div key="step-2" className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Dados da sua empresa</h2>
        <p className="text-gray-500 mt-2">Informe os dados cadastrais e crie sua conta de administrador.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-700" /> Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nome-empresa">Nome da Empresa / Razão Social *</Label>
            <Input id="nome-empresa" placeholder="Ex: Móveis Pedro II Ltda" value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)} className="mt-1" required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cnpj">CNPJ ou CPF *</Label>
              <Input id="cnpj" placeholder="00.000.000/0001-00" value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))} className="mt-1" required />
            </div>
            <div>
              <Label htmlFor="whatsapp-empresa">WhatsApp</Label>
              <Input id="whatsapp-empresa" placeholder="(24) 99999-0000" value={whatsappEmpresa}
                onChange={(e) => setWhatsappEmpresa(formatPhone(e.target.value))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="email-empresa">Email da Empresa *</Label>
            <Input id="email-empresa" type="email" placeholder="contato@suaempresa.com.br" value={emailEmpresa}
              onChange={(e) => setEmailEmpresa(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label>Logo da Empresa</Label>
            <div className="mt-2 flex items-center gap-4">
              {logoUrl ? (
                <div className="w-16 h-16 border rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 border border-dashed rounded-lg flex items-center justify-center text-gray-400 text-xs text-center p-2">
                  Sem Logo
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  id="logo"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("logo").click()}
                  disabled={uploadingLogo}
                  className="border-green-200 text-green-800 hover:bg-green-50"
                >
                  {uploadingLogo ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Enviando...</>
                  ) : (
                    <>Escolher Imagem</>
                  )}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl("")}
                    className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5 text-green-700" /> Conta do Administrador
          </CardTitle>
          <CardDescription>Essa será sua conta pessoal para acessar o sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nome-admin">Nome Completo *</Label>
            <Input id="nome-admin" placeholder="Seu nome completo" value={nomeAdmin}
              onChange={(e) => setNomeAdmin(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="email-admin">Email de Login *</Label>
            <Input id="email-admin" type="email" placeholder="seu.email@provedor.com" value={emailAdmin}
              onChange={(e) => setEmailAdmin(e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label htmlFor="senha-admin">Senha *</Label>
            <div className="relative mt-1">
              <Input id="senha-admin" type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres"
                value={senhaAdmin} onChange={(e) => setSenhaAdmin(e.target.value)} className="pr-10" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ========== STEP 3: PAGAMENTO ==========
  const renderStepPagamento = () => (
    <div key="step-3" className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Forma de Pagamento</h2>
        <p className="text-gray-500 mt-2">
          Assinatura de <strong>{selectedPlan?.nome}</strong> — {formatCurrency(selectedPlan?.preco_mensal || 0)}/mês
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "PIX", label: "PIX", Icon: QrCode },
              { key: "BOLETO", label: "Boleto", Icon: FileText },
              { key: "CREDIT_CARD", label: "Cartão", Icon: CreditCard },
            ].map(({ key, label, Icon }) => (
              <button key={key} type="button" onClick={() => setPaymentMethod(key)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-sm font-medium transition-all ${
                  paymentMethod === key
                    ? "border-green-700 bg-green-50 text-green-800 ring-2 ring-green-700/20"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                <Icon className="w-5 h-5 mb-1.5" />
                {label}
              </button>
            ))}
          </div>

          {paymentMethod === "CREDIT_CARD" && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-green-700" /> Dados do Cartão
              </h4>
              <div>
                <Label className="text-xs font-semibold text-gray-500">Nome Impresso no Cartão</Label>
                <Input placeholder="NOME DO TITULAR" value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value.toUpperCase())} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500">Número do Cartão</Label>
                <Input placeholder="0000 0000 0000 0000" value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").substring(0, 16))} className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-500">Mês Exp.</Label>
                  <Input placeholder="MM" value={cardExpiryMonth}
                    onChange={(e) => setCardExpiryMonth(e.target.value.replace(/\D/g, "").substring(0, 2))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500">Ano Exp.</Label>
                  <Input placeholder="AAAA" value={cardExpiryYear}
                    onChange={(e) => setCardExpiryYear(e.target.value.replace(/\D/g, "").substring(0, 4))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500">CVV</Label>
                  <Input placeholder="123" value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").substring(0, 4))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <Label className="text-xs font-semibold text-gray-500">CEP</Label>
                  <Input placeholder="00000-000" value={holderPostalCode}
                    onChange={(e) => setHolderPostalCode(e.target.value.replace(/\D/g, "").substring(0, 8))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-500">Nº Endereço</Label>
                  <Input placeholder="123" value={holderAddressNumber}
                    onChange={(e) => setHolderAddressNumber(e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-bold text-green-800 mb-2">Resumo do Cadastro</h4>
        <div className="text-sm text-green-700 space-y-1">
          <p><strong>Empresa:</strong> {nomeEmpresa}</p>
          <p><strong>Plano:</strong> {selectedPlan?.nome} — {formatCurrency(selectedPlan?.preco_mensal || 0)}/mês</p>
          <p><strong>Admin:</strong> {nomeAdmin} ({emailAdmin})</p>
          <p><strong>Pagamento:</strong> {paymentMethod === "PIX" ? "PIX" : paymentMethod === "BOLETO" ? "Boleto" : "Cartão de Crédito"}</p>
        </div>
      </div>
    </div>
  );

  // ========== STEP 4: SUCESSO ==========
  const renderStepSucesso = () => (
    <div className="max-w-lg mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-green-700" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Cadastro Realizado! 🎉</h2>
      <p className="text-gray-500">
        Sua empresa <strong>{nomeEmpresa}</strong> foi criada com sucesso no MPII Hub.
      </p>

      {result?.matricula && (
        <Card className="text-left">
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Matrícula do Admin:</span>
              <span className="font-mono font-bold text-green-800">{result.matricula}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email de Login:</span>
              <span className="font-medium">{emailAdmin}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {result?.payment?.pixQrCode && (
        <Card className="text-left">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-5 h-5 text-green-700" /> Pague via PIX
            </CardTitle>
            <CardDescription>Escaneie o QR Code ou copie o código abaixo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <img src={`data:image/png;base64,${result.payment.pixQrCode}`} alt="QR Code PIX" className="w-48 h-48" />
            </div>
            {result.payment.pixCopiaCola && (
              <div>
                <Label className="text-xs text-gray-500">PIX Copia e Cola</Label>
                <div className="mt-1 p-2 bg-gray-50 border rounded text-xs font-mono break-all select-all cursor-pointer"
                  onClick={() => { navigator.clipboard.writeText(result.payment.pixCopiaCola); toast.success("Código copiado!"); }}>
                  {result.payment.pixCopiaCola}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result?.payment?.invoiceUrl && !result?.payment?.pixQrCode && (
        <Card className="text-left">
          <CardContent className="pt-6">
            <a href={result.payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-green-700 hover:bg-green-800">
                <FileText className="w-4 h-4 mr-2" /> Visualizar Boleto / Fatura
              </Button>
            </a>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleLoginRedirect} className="w-full bg-green-700 hover:bg-green-800 h-12 text-base">
        Acessar o Sistema <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao site
          </button>
          <h1 className="text-lg font-bold" style={{ color: "#07593f" }}>MPII Hub — Cadastro</h1>
          <div />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {step <= 3 && renderStepper()}

        {step === 1 && renderStepPlanos()}
        {step === 2 && renderStepDadosEmpresa()}
        {step === 3 && renderStepPagamento()}
        {step === 4 && renderStepSucesso()}

        {/* Navigation Buttons */}
        {step <= 3 && (
          <div className="flex justify-between mt-8 max-w-xl mx-auto">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
                <ChevronLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
            ) : <div />}

            {step < 3 ? (
              <Button
                className="bg-green-700 hover:bg-green-800"
                disabled={step === 1 && !selectedPlan}
                onClick={() => {
                  if (step === 2 && !validateStep2()) return;
                  setStep(step + 1);
                }}
              >
                Continuar <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                className="bg-green-700 hover:bg-green-800"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processando...</>
                ) : (
                  <>Finalizar Cadastro <ChevronRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
