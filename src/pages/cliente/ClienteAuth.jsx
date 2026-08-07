import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { getPortalTheme } from "@/config/portalThemes";
import { supabase } from "@/api/base44Client";
import { processarFidelidadeCadastro } from "@/utils/fidelidadeEngine";
import { ensureClientPortalSession, trackClientAccessEvent } from "@/lib/clienteAccessTracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
    Loader2, Mail, Lock, User, Phone, MapPin, Search,
    ArrowLeft, Sparkles, Check, Eye, EyeOff, Building, Crown,
    UserCircle, CreditCard, Hash, Calendar, Map, Navigation, Home, Globe, Info, Store
} from "lucide-react";

const HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop";

export default function ClienteAuth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { organization, settings, brandName, brandLogo, isDomainResolved } = useTenant();

    const themeId = settings?.portal_theme || settings?.modulos_ativos?.portal_theme || "luxo";
    const portalTheme = getPortalTheme(themeId).auth;

    const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

    const [activeTab, setActiveTab] = useState(initialMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [registrationStep, setRegistrationStep] = useState(1);
    const [signupBonus, setSignupBonus] = useState(2);
    const [signupBonusAtivo, setSignupBonusAtivo] = useState(true);
    const [nomePontosSingular, setNomePontosSingular] = useState("Coroa");
    const [nomePontosPlural, setNomePontosPlural] = useState("Coroas");

    useEffect(() => {
        async function fetchConfig() {
            try {
                const { data } = await supabase.from("fidelidade_config").select("signup_bonus, signup_bonus_ativo, nome_pontos_singular, nome_pontos_plural").eq("is_active", true).maybeSingle();
                if (data) {
                    if (data.signup_bonus !== undefined) setSignupBonus(data.signup_bonus);
                    if (data.signup_bonus_ativo !== undefined) setSignupBonusAtivo(data.signup_bonus_ativo !== false);
                    if (data.nome_pontos_singular) setNomePontosSingular(data.nome_pontos_singular);
                    if (data.nome_pontos_plural) setNomePontosPlural(data.nome_pontos_plural);
                }
            } catch (err) {
                // fallback to 2
            }
        }
        fetchConfig();
    }, []);

    // Login form
    const [loginData, setLoginData] = useState({ email: "", password: "" });

    // Registration form - comprehensive like ClienteModal
    const [registerData, setRegisterData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        nome_completo: "",
        tipo_pessoa: "Física",
        cpf: "",
        cnpj: "",
        razao_social: "",
        telefone: "",
        data_nascimento: "",
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
    });

    // Format CPF
    const formatarCPF = (valor) => {
        const numeros = valor.replace(/\D/g, '');
        if (numeros.length <= 11) {
            return numeros
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        return valor;
    };

    // Format CNPJ
    const formatarCNPJ = (valor) => {
        const numeros = valor.replace(/\D/g, '');
        if (numeros.length <= 14) {
            return numeros
                .replace(/(\d{2})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1/$2')
                .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
        }
        return valor;
    };

    // Format phone
    const formatarTelefone = (valor) => {
        const numeros = valor.replace(/\D/g, '');
        if (numeros.length <= 11) {
            if (numeros.length <= 10) {
                return numeros
                    .replace(/(\d{2})(\d)/, '($1) $2')
                    .replace(/(\d{4})(\d)/, '$1-$2');
            }
            return numeros
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{5})(\d)/, '$1-$2');
        }
        return valor;
    };

    // Fetch CEP
    const buscarCEP = async (cep) => {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        setBuscandoCep(true);
        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setRegisterData(prev => ({
                    ...prev,
                    endereco: data.logradouro || "",
                    bairro: data.bairro || "",
                    cidade: data.localidade || "",
                    estado: data.uf || "",
                }));
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        } finally {
            setBuscandoCep(false);
        }
    };

    // Login handler
    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email: loginData.email,
                password: loginData.password,
            });

            if (authError) throw authError;

            // Check if user is linked to a cliente
            const { data: cliente, error: clienteError } = await supabase
                .from("clientes")
                .select("*")
                .eq("user_id", data.user.id)
                .maybeSingle();

            if (clienteError && clienteError.code !== "PGRST116") {
                console.error("Erro ao buscar cliente:", clienteError);
            }

            const accessSession = await ensureClientPortalSession({
                authUserId: data.user.id,
                clienteId: cliente?.id,
                pagePath: "/cliente-login",
            });

            if (accessSession?.sessionId) {
                await trackClientAccessEvent({
                    sessionId: accessSession.sessionId,
                    authUserId: data.user.id,
                    clienteId: cliente?.id,
                    eventName: "login_success",
                    eventCategory: "auth",
                    pagePath: "/cliente-login",
                    metadata: { source: "password" },
                    dedupeKey: `login_success_${data.user.id}`,
                });
            }

            toast.success("Login realizado com sucesso!");
            const targetUrl = (!isDomainResolved && organization?.slug) ? `/${organization.slug}/area-cliente` : "/area-cliente";
            navigate(targetUrl);
        } catch (err) {
            console.error("Erro no login:", err);
            if (err.message.includes("Invalid login")) {
                setError("E-mail ou senha incorretos");
            } else {
                setError(err.message || "Erro ao fazer login");
            }
        } finally {
            setLoading(false);
        }
    };

    // Registration handler
    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");

        // Validation
        if (registerData.password !== registerData.confirmPassword) {
            setError("As senhas não coincidem");
            return;
        }

        if (registerData.password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres");
            return;
        }

        if (!registerData.nome_completo || !registerData.telefone) {
            setError("Nome e telefone são obrigatórios");
            return;
        }

        setLoading(true);

        try {
            // 1. Create Auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: registerData.email,
                password: registerData.password,
                options: {
                    data: {
                        nome: registerData.nome_completo,
                        tipo: "cliente",
                    }
                }
            });

            if (authError) throw authError;

            // 2. Bonus steps will be applied via fidelidadeEngine after client record is created
            const bonusSteps = 0; // legacy variable kept for toast message — actual bonus applied below

            // 3. Check if there's an existing client with the same CPF/CNPJ (from PDV purchases)
            const docToMatch = registerData.tipo_pessoa === "Física"
                ? registerData.cpf?.replace(/\D/g, '')
                : registerData.cnpj?.replace(/\D/g, '');

            let existingClient = null;

            if (docToMatch && docToMatch.length > 0) {
                const { data: foundClient } = await supabase
                    .from("clientes")
                    .select("*")
                    .or(`cpf.ilike.%${docToMatch}%,cnpj.ilike.%${docToMatch}%`)
                    .is("user_id", null) // Only match clients without VIP account
                    .single();

                existingClient = foundClient;
            }

            if (existingClient) {
                // 4a. Link existing client to user account
                const updateData = {
                    user_id: authData.user.id,
                    email: registerData.email,
                };

                // Update fields only if they were empty
                if (!existingClient.data_nascimento && registerData.data_nascimento) {
                    updateData.data_nascimento = registerData.data_nascimento;
                }
                if (!existingClient.cep && registerData.cep) {
                    updateData.cep = registerData.cep;
                    updateData.rua = registerData.endereco;
                    updateData.endereco = registerData.endereco;
                    updateData.numero = registerData.numero;
                    updateData.complemento = registerData.complemento;
                    updateData.bairro = registerData.bairro;
                    updateData.cidade = registerData.cidade;
                    updateData.estado = registerData.estado;
                }

                const { error: updateError } = await supabase
                    .from("clientes")
                    .update(updateData)
                    .eq("id", existingClient.id);

                if (updateError) throw updateError;

                // Apply signup bonus via engine (reads config from DB)
                const bonusResult = await processarFidelidadeCadastro({ id: existingClient.id, coroas: existingClient.coroas || 0, nome_completo: existingClient.nome_completo });
                toast.success(`Bem-vindo de volta! ${bonusResult.coroasGanhas > 0 ? `+${bonusResult.coroasGanhas} Coroas de bonus vinculadas!` : `Suas ${existingClient.coroas || 0} Coroas foram vinculadas!`}`);
            } else {
                // 4b. Create new cliente record
                const clienteData = {
                    organization_id: organization?.id || null,
                    user_id: authData.user.id,
                    nome_completo: registerData.nome_completo,

                    nome: registerData.nome_completo,
                    tipo_pessoa: registerData.tipo_pessoa,
                    cpf: registerData.tipo_pessoa === "Física" ? registerData.cpf || null : null,
                    cnpj: registerData.tipo_pessoa === "Jurídica" ? registerData.cnpj || null : null,
                    razao_social: registerData.tipo_pessoa === "Jurídica" ? registerData.razao_social || null : null,
                    telefone: registerData.telefone,
                    email: registerData.email,
                    data_nascimento: registerData.data_nascimento || null,
                    cep: registerData.cep || null,
                    rua: registerData.endereco || null,
                    endereco: registerData.endereco || null,
                    numero: registerData.numero || null,
                    complemento: registerData.complemento || null,
                    bairro: registerData.bairro || null,
                    cidade: registerData.cidade || null,
                    estado: registerData.estado || null,
                };

                const { data: novoCliente, error: clienteError } = await supabase
                    .from("clientes")
                    .insert(clienteData)
                    .select("id, coroas, nome_completo")
                    .single();

                if (clienteError) throw clienteError;

                // Apply signup bonus via engine
                const bonusResult = await processarFidelidadeCadastro(novoCliente || { id: novoCliente?.id, coroas: 0, nome_completo: registerData.nome_completo });
                toast.success(`Cadastro realizado! ${bonusResult.coroasGanhas > 0 ? `Voce ganhou ${bonusResult.coroasGanhas} Coroas de boas-vindas!` : 'Bem-vindo!'}`);
            }

            // Verifica se sessão foi criada (auto-confirm ativo) ou se e-mail precisa ser confirmado
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (newSession) {
                const targetUrl = (!isDomainResolved && organization?.slug) ? `/${organization.slug}/area-cliente` : "/area-cliente";
                navigate(targetUrl);
            } else {
                toast.success("Quase lá! Verifique seu e-mail para confirmar o cadastro.");
                setActiveTab("login");
                setRegistrationStep(1);
            }
        } catch (err) {
            console.error("Erro no cadastro:", err);
            // Check for duplicate user error (Supabase Auth)
            if (err.message?.includes("already registered") || err.message?.includes("User already registered")) {
                toast.error("Este e-mail já possui cadastro. Redirecionando para o login...");
                setActiveTab("login");
                setLoginData(prev => ({ ...prev, email: registerData.email }));
                setError("Conta já existente. Por favor, faça login.");
            } else {
                setError(err.message || "Erro ao criar conta");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`min-h-screen font-sans relative flex items-center justify-center p-4 overflow-hidden ${portalTheme.bg}`}>
            {/* Import Premium Fonts */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        .font-serif { fontFamily: 'Playfair Display', serif; }
        .font-body { fontFamily: 'Lato', sans-serif; }
      `}</style>

            {/* Background with Overlay */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transform scale-105 blur-[2px]"
                style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            >
                <div className={`absolute inset-0 ${portalTheme.heroBg} backdrop-blur-sm`}></div>
            </div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
                {/* Back to Landing */}
                <Link
                    to="/"
                    className={`inline-flex items-center gap-2 mb-6 group font-body transition-colors text-sm font-medium ${portalTheme.backLink || 'text-stone-300 hover:text-amber-400'}`}
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para o início
                </Link>

                <Card className={`border shadow-2xl rounded-3xl overflow-hidden ${portalTheme.card}`}>
                    <CardHeader className="text-center pb-6 border-b border-stone-500/10">
                        {brandLogo ? (
                            <img src={brandLogo} alt={brandName} className="h-16 mx-auto mb-4 object-contain" />
                        ) : (
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                                <Store className={`w-8 h-8 ${portalTheme.accentText}`} />
                            </div>
                        )}
                        <CardTitle className={`text-3xl ${portalTheme.textHeading}`}>{brandName || 'Área do Cliente'}</CardTitle>
                        <CardDescription className={`text-sm ${portalTheme.textMuted}`}>
                            {activeTab === "login"
                                ? "Bem-vindo de volta! Acesse sua conta."
                                : "Cadastre-se e entre para o Clube Real."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setRegistrationStep(1); setError(""); }}>
                            <TabsList className={`grid w-full grid-cols-2 mb-8 p-1 rounded-2xl ${portalTheme.tabList || 'bg-black/20 border border-white/5'}`}>
                                <TabsTrigger
                                    value="login"
                                    className={`rounded-xl font-bold transition-all duration-300 ${activeTab === 'login' ? portalTheme.tabActive : portalTheme.tabInactive}`}
                                >
                                    Entrar
                                </TabsTrigger>
                                <TabsTrigger
                                    value="register"
                                    className={`rounded-xl font-bold transition-all duration-300 ${activeTab === 'register' ? portalTheme.tabActive : portalTheme.tabInactive}`}
                                >
                                    Cadastrar
                                </TabsTrigger>
                            </TabsList>

                            {error && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {/* LOGIN TAB */}
                            <TabsContent value="login">
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <Label htmlFor="login-email" className={portalTheme.inputLabel || portalTheme.textMuted}>E-mail</Label>
                                        <div className="relative mt-1">
                                            <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                            <Input
                                                id="login-email"
                                                type="email"
                                                placeholder="seu@email.com"
                                                className={`pl-10 h-12 rounded-xl ${portalTheme.input}`}
                                                value={loginData.email}
                                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="login-password" className={portalTheme.inputLabel || portalTheme.textMuted}>Senha</Label>
                                        <div className="relative mt-1">
                                            <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                            <Input
                                                id="login-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className={`pl-10 pr-10 h-12 rounded-xl ${portalTheme.input}`}
                                                value={loginData.password}
                                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className={`w-full font-bold h-12 rounded-xl text-base transition-all hover:scale-[1.01] ${portalTheme.primaryButton}`}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Entrando...
                                            </>
                                        ) : (
                                            "Acessar Conta"
                                        )}
                                    </Button>
                                </form>
                            </TabsContent>

                            {/* REGISTER TAB */}
                            <TabsContent value="register">
                                <form onSubmit={handleRegister} className="space-y-4">
                                    {/* Loyalty Banner */}
                                    {signupBonusAtivo && (
                                        <div className={`p-4 rounded-xl flex items-center gap-4 mb-6 shadow-sm border ${portalTheme.bonusBanner || 'bg-amber-50 border-amber-200 text-amber-950'}`}>
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-md ${portalTheme.bonusIcon || 'bg-amber-400 text-stone-950'}`}>
                                                <Crown className="w-6 h-6 fill-current" />
                                            </div>
                                            <div>
                                                <p className={portalTheme.bonusTitle || 'font-serif font-bold text-stone-900 text-lg'}>
                                                    Ganhe {signupBonus} {signupBonus === 1 ? nomePontosSingular : nomePontosPlural} de Bônus
                                                </p>
                                                <p className={portalTheme.bonusText || 'text-sm text-stone-600 font-body'}>Cadastre-se agora e comece com vantagens exclusivas.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 1: Account Info */}
                                    {registrationStep === 1 && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <Label htmlFor="tipo_pessoa" className={portalTheme.inputLabel}>Tipo de Pessoa</Label>
                                                    <div className="relative mt-1">
                                                        <UserCircle className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText} z-10`} />
                                                        <Select
                                                            value={registerData.tipo_pessoa}
                                                            onValueChange={(value) => setRegisterData({ ...registerData, tipo_pessoa: value })}
                                                        >
                                                            <SelectTrigger className={`mt-1 pl-10 h-11 rounded-xl ${portalTheme.input}`}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Física">Pessoa Física</SelectItem>
                                                                <SelectItem value="Jurídica">Pessoa Jurídica</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="nome_completo" className={portalTheme.inputLabel}>
                                                    {registerData.tipo_pessoa === "Física" ? "Nome Completo *" : "Nome Fantasia *"}
                                                </Label>
                                                <div className="relative mt-1">
                                                    <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="nome_completo"
                                                        placeholder="Seu nome completo"
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.nome_completo}
                                                        onChange={(e) => setRegisterData({ ...registerData, nome_completo: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            {registerData.tipo_pessoa === "Física" ? (
                                                <div>
                                                    <Label htmlFor="cpf" className={portalTheme.inputLabel}>CPF</Label>
                                                    <div className="relative mt-1">
                                                        <CreditCard className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                        <Input
                                                            id="cpf"
                                                            placeholder="000.000.000-00"
                                                            className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                            value={registerData.cpf}
                                                            onChange={(e) => setRegisterData({ ...registerData, cpf: formatarCPF(e.target.value) })}
                                                            maxLength={14}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <Label htmlFor="cnpj" className={portalTheme.inputLabel}>CNPJ</Label>
                                                        <div className="relative mt-1">
                                                            <CreditCard className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                            <Input
                                                                id="cnpj"
                                                                placeholder="00.000.000/0000-00"
                                                                className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                                value={registerData.cnpj}
                                                                onChange={(e) => setRegisterData({ ...registerData, cnpj: formatarCNPJ(e.target.value) })}
                                                                maxLength={18}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="razao_social" className={portalTheme.inputLabel}>Razão Social</Label>
                                                        <div className="relative mt-1">
                                                            <Building className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                            <Input
                                                                id="razao_social"
                                                                placeholder="Razão Social da empresa"
                                                                className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                                value={registerData.razao_social}
                                                                onChange={(e) => setRegisterData({ ...registerData, razao_social: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div>
                                                <Label htmlFor="telefone" className={portalTheme.inputLabel}>Telefone *</Label>
                                                <div className="relative mt-1">
                                                    <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="telefone"
                                                        placeholder="(00) 00000-0000"
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.telefone}
                                                        onChange={(e) => setRegisterData({ ...registerData, telefone: formatarTelefone(e.target.value) })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="data_nascimento" className={portalTheme.inputLabel}>Data de Nascimento</Label>
                                                <div className="relative mt-1">
                                                    <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="data_nascimento"
                                                        type="date" lang="pt-BR"
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.data_nascimento}
                                                        onChange={(e) => setRegisterData({ ...registerData, data_nascimento: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                className={`w-full font-bold h-12 rounded-xl text-base ${portalTheme.primaryButton}`}
                                                onClick={() => {
                                                    if (!registerData.nome_completo || !registerData.telefone) {
                                                        setError("Nome e telefone são obrigatórios");
                                                        return;
                                                    }
                                                    setError("");
                                                    setRegistrationStep(2);
                                                }}
                                            >
                                                Continuar
                                            </Button>
                                        </>
                                    )}

                                    {/* Step 2: Address */}
                                    {registrationStep === 2 && (
                                        <>
                                            <div className="flex items-center gap-2 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setRegistrationStep(1)}
                                                    className={`hover:opacity-80 transition-opacity ${portalTheme.accentText}`}
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <span className={`text-sm ${portalTheme.textMuted}`}>Passo 2 de 3: Endereço (opcional)</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2">
                                                    <Label htmlFor="cep" className={portalTheme.inputLabel}>CEP</Label>
                                                    <div className="flex gap-2 mt-1 relative">
                                                        <div className="relative flex-1">
                                                            <Hash className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                            <Input
                                                                id="cep"
                                                                placeholder="00000-000"
                                                                className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                                value={registerData.cep}
                                                                onChange={(e) => setRegisterData({ ...registerData, cep: e.target.value })}
                                                                onBlur={(e) => buscarCEP(e.target.value)}
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-11 rounded-xl"
                                                            onClick={() => buscarCEP(registerData.cep)}
                                                            disabled={buscandoCep}
                                                        >
                                                            {buscandoCep ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Search className="w-4 h-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="numero" className={portalTheme.inputLabel}>Número</Label>
                                                    <div className="relative mt-1">
                                                        <Navigation className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                        <Input
                                                            id="numero"
                                                            placeholder="123"
                                                            className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                            value={registerData.numero}
                                                            onChange={(e) => setRegisterData({ ...registerData, numero: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="endereco" className={portalTheme.inputLabel}>Endereço</Label>
                                                <div className="relative mt-1">
                                                    <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="endereco"
                                                        placeholder="Rua, Avenida..."
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.endereco}
                                                        onChange={(e) => setRegisterData({ ...registerData, endereco: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="relative mt-1">
                                                    <Info className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="complemento"
                                                        placeholder="Apto, Bloco..."
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.complemento}
                                                        onChange={(e) => setRegisterData({ ...registerData, complemento: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <Label htmlFor="bairro" className={portalTheme.inputLabel}>Bairro</Label>
                                                    <div className="relative mt-1">
                                                        <Map className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                        <Input
                                                            id="bairro"
                                                            placeholder="Bairro"
                                                            className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                            value={registerData.bairro}
                                                            onChange={(e) => setRegisterData({ ...registerData, bairro: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="cidade" className={portalTheme.inputLabel}>Cidade</Label>
                                                    <div className="relative mt-1">
                                                        <Home className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                        <Input
                                                            id="cidade"
                                                            placeholder="Cidade"
                                                            className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                            value={registerData.cidade}
                                                            onChange={(e) => setRegisterData({ ...registerData, cidade: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="estado" className={portalTheme.inputLabel}>UF</Label>
                                                    <div className="relative mt-1">
                                                        <Globe className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                        <Input
                                                            id="estado"
                                                            placeholder="UF"
                                                            className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                            value={registerData.estado}
                                                            onChange={(e) => setRegisterData({ ...registerData, estado: e.target.value.toUpperCase() })}
                                                            maxLength={2}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                className={`w-full font-bold h-12 rounded-xl text-base ${portalTheme.primaryButton}`}
                                                onClick={() => setRegistrationStep(3)}
                                            >
                                                Continuar
                                            </Button>
                                        </>
                                    )}

                                    {/* Step 3: Account Credentials */}
                                    {registrationStep === 3 && (
                                        <>
                                            <div className="flex items-center gap-2 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setRegistrationStep(2)}
                                                    className={`hover:opacity-80 transition-opacity ${portalTheme.accentText}`}
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <span className={`text-sm ${portalTheme.textMuted}`}>Passo 3 de 3: Credenciais</span>
                                            </div>

                                            <div>
                                                <Label htmlFor="register-email" className={portalTheme.inputLabel}>E-mail *</Label>
                                                <div className="relative mt-1">
                                                    <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="register-email"
                                                        type="email"
                                                        placeholder="seu@email.com"
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.email}
                                                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="register-password" className={portalTheme.inputLabel}>Senha *</Label>
                                                <div className="relative mt-1">
                                                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="register-password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Mínimo 6 caracteres"
                                                        className={`pl-10 pr-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.password}
                                                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="confirm-password" className={portalTheme.inputLabel}>Confirmar Senha *</Label>
                                                <div className="relative mt-1">
                                                    <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${portalTheme.accentText}`} />
                                                    <Input
                                                        id="confirm-password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Confirme sua senha"
                                                        className={`pl-10 h-11 rounded-xl ${portalTheme.input}`}
                                                        value={registerData.confirmPassword}
                                                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                                                        required
                                                    />
                                                    {registerData.confirmPassword && registerData.password === registerData.confirmPassword && (
                                                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className={`w-full font-bold h-12 rounded-xl text-base shadow-lg transition-all hover:scale-[1.02] ${portalTheme.primaryButton}`}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                        Cadastrando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5 mr-2" />
                                                        Criar Conta VIP
                                                    </>
                                                )}
                                            </Button>
                                        </>
                                    )}

                                    {/* Step Indicators */}
                                    <div className="flex justify-center gap-2 pt-2">
                                        {[1, 2, 3].map((step) => (
                                            <div
                                                key={step}
                                                className={`w-2 h-2 rounded-full transition-colors ${registrationStep >= step ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-700"
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Legal Footer */}
                <p className={`text-center text-xs mt-6 ${portalTheme.textMuted}`}>
                    Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade.
                </p>
            </div>
        </div>
    );
}
