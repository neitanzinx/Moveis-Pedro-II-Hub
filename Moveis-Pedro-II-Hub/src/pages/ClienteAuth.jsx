import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { EMPRESA } from "@/config/empresa";
import { supabase } from "@/api/base44Client";
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
    UserCircle, CreditCard, Hash, Calendar, Map, Navigation, Home, Globe, Info
} from "lucide-react";

const LOGO_URL = EMPRESA.logo_url;
const HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop";

export default function ClienteAuth() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialMode = searchParams.get("mode") === "register" ? "register" : "login";

    const [activeTab, setActiveTab] = useState(initialMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [registrationStep, setRegistrationStep] = useState(1);

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
                .single();

            if (clienteError && clienteError.code !== "PGRST116") {
                console.error("Erro ao buscar cliente:", clienteError);
            }

            toast.success("Login realizado com sucesso!");
            navigate("/area-cliente");
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

            // 2. Get loyalty config for bonus steps
            const { data: fidelidadeConfig } = await supabase
                .from("fidelidade_config")
                .select("signup_bonus")
                .eq("is_active", true)
                .single();

            const bonusSteps = fidelidadeConfig?.signup_bonus || 2;

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
                    fidelidade_steps: (existingClient.fidelidade_steps || 0) + bonusSteps, // Add bonus to existing
                    coroas: (existingClient.coroas || 0) + bonusSteps,
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

                toast.success(`Bem-vindo de volta! Suas ${existingClient.fidelidade_steps || 0} Coroas anteriores + ${bonusSteps} bônus foram vinculadas!`);
            } else {
                // 4b. Create new cliente record
                const clienteData = {
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
                    fidelidade_steps: bonusSteps,
                    coroas: bonusSteps,
                };

                const { error: clienteError } = await supabase
                    .from("clientes")
                    .insert(clienteData);

                if (clienteError) throw clienteError;

                toast.success(`Cadastro realizado! Você ganhou ${bonusSteps} Coroas de boas-vindas!`);
            }

            navigate("/area-cliente");
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
        <div className="min-h-screen font-sans selection:bg-amber-100 selection:text-green-900 relative flex items-center justify-center p-4 overflow-hidden">
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
                <div className="absolute inset-0 bg-green-950/80 backdrop-blur-sm"></div>
            </div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in-up">
                {/* Back to Landing */}
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-stone-300 hover:text-amber-400 mb-6 group font-body transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para o início
                </Link>

                <Card className="border-white/20 shadow-2xl bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="text-center pb-6 border-b border-stone-100 bg-white/50">
                        <img src={LOGO_URL} alt="Móveis Pedro II" className="h-16 mx-auto mb-4 object-contain" />
                        <CardTitle className="text-3xl font-serif text-green-950">Área do Cliente</CardTitle>
                        <CardDescription className="font-body text-stone-600 text-base">
                            {activeTab === "login"
                                ? "Bem-vindo de volta! Acesse sua conta."
                                : "Cadastre-se e entre para o Clube Real."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2 mb-8 p-1 bg-stone-100 rounded-xl">
                                <TabsTrigger
                                    value="login"
                                    className="data-[state=active]:bg-white data-[state=active]:text-green-950 data-[state=active]:shadow-md rounded-lg font-bold font-body transition-all duration-300"
                                >
                                    Entrar
                                </TabsTrigger>
                                <TabsTrigger
                                    value="register"
                                    className="data-[state=active]:bg-white data-[state=active]:text-green-950 data-[state=active]:shadow-md rounded-lg font-bold font-body transition-all duration-300"
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
                                        <Label htmlFor="login-email">E-mail</Label>
                                        <div className="relative mt-1">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                            <Input
                                                id="login-email"
                                                type="email"
                                                placeholder="seu@email.com"
                                                className="pl-10 h-12 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                value={loginData.email}
                                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="login-password">Senha</Label>
                                        <div className="relative mt-1">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                            <Input
                                                id="login-password"
                                                type={showPassword ? "text" : "password"}
                                                placeholder="••••••••"
                                                className="pl-10 pr-10 h-12 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                value={loginData.password}
                                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-green-950 hover:bg-green-900 text-white font-bold h-12 rounded-xl shadow-lg shadow-green-950/20 text-lg transition-all hover:scale-[1.02]"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin text-amber-400" />
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
                                    <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 p-4 rounded-xl flex items-center gap-4 mb-6 shadow-sm">
                                        <div className="w-12 h-12 bg-amber-400 text-green-950 rounded-full flex items-center justify-center shrink-0 shadow-md">
                                            <Crown className="w-6 h-6 fill-current" />
                                        </div>
                                        <div>
                                            <p className="font-serif font-bold text-green-950 text-lg">Ganhe 2 Coroas de Bônus</p>
                                            <p className="text-sm text-stone-600 font-body">Cadastre-se agora e comece com vantagens exclusivas.</p>
                                        </div>
                                    </div>

                                    {/* Step 1: Account Info */}
                                    {registrationStep === 1 && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <Label htmlFor="tipo_pessoa">Tipo de Pessoa</Label>
                                                    <div className="relative mt-1">
                                                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 z-10" />
                                                        <Select
                                                            value={registerData.tipo_pessoa}
                                                            onValueChange={(value) => setRegisterData({ ...registerData, tipo_pessoa: value })}
                                                        >
                                                            <SelectTrigger className="mt-1 pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl">
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
                                                <Label htmlFor="nome_completo">
                                                    {registerData.tipo_pessoa === "Física" ? "Nome Completo *" : "Nome Fantasia *"}
                                                </Label>
                                                <div className="relative mt-1">
                                                    <div className="relative mt-1">
                                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="nome_completo"
                                                            placeholder="Seu nome completo"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.nome_completo}
                                                            onChange={(e) => setRegisterData({ ...registerData, nome_completo: e.target.value })}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {registerData.tipo_pessoa === "Física" ? (
                                                <div>
                                                    <Label htmlFor="cpf">CPF</Label>
                                                    <div className="relative mt-1">
                                                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="cpf"
                                                            placeholder="000.000.000-00"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.cpf}
                                                            onChange={(e) => setRegisterData({ ...registerData, cpf: formatarCPF(e.target.value) })}
                                                            maxLength={14}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <Label htmlFor="cnpj">CNPJ</Label>
                                                        <div className="relative mt-1">
                                                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                            <Input
                                                                id="cnpj"
                                                                placeholder="00.000.000/0000-00"
                                                                className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                                value={registerData.cnpj}
                                                                onChange={(e) => setRegisterData({ ...registerData, cnpj: formatarCNPJ(e.target.value) })}
                                                                maxLength={18}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="razao_social">Razão Social</Label>
                                                        <div className="relative mt-1">
                                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                            <Input
                                                                id="razao_social"
                                                                placeholder="Razão Social da empresa"
                                                                className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                                value={registerData.razao_social}
                                                                onChange={(e) => setRegisterData({ ...registerData, razao_social: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div>
                                                <Label htmlFor="telefone">Telefone *</Label>
                                                <div className="relative mt-1">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="telefone"
                                                        placeholder="(00) 00000-0000"
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.telefone}
                                                        onChange={(e) => setRegisterData({ ...registerData, telefone: formatarTelefone(e.target.value) })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                                                <div className="relative mt-1">
                                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="data_nascimento"
                                                        type="date"
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.data_nascimento}
                                                        onChange={(e) => setRegisterData({ ...registerData, data_nascimento: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                className="w-full bg-green-700 hover:bg-green-800"
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
                                                    className="text-green-700 hover:text-green-800"
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <span className="text-sm text-gray-500">Passo 2 de 3: Endereço (opcional)</span>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="col-span-2">
                                                    <Label htmlFor="cep">CEP</Label>
                                                    <div className="flex gap-2 mt-1 relative">
                                                        <div className="relative flex-1">
                                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                            <Input
                                                                id="cep"
                                                                placeholder="00000-000"
                                                                className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
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
                                                    <Label htmlFor="numero">Número</Label>
                                                    <div className="relative mt-1">
                                                        <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="numero"
                                                            placeholder="123"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.numero}
                                                            onChange={(e) => setRegisterData({ ...registerData, numero: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="endereco">Endereço</Label>
                                                <div className="relative mt-1">
                                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="endereco"
                                                        placeholder="Rua, Avenida..."
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.endereco}
                                                        onChange={(e) => setRegisterData({ ...registerData, endereco: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <div className="relative mt-1">
                                                    <Info className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="complemento"
                                                        placeholder="Apto, Bloco..."
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.complemento}
                                                        onChange={(e) => setRegisterData({ ...registerData, complemento: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <Label htmlFor="bairro">Bairro</Label>
                                                    <div className="relative mt-1">
                                                        <Map className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="bairro"
                                                            placeholder="Bairro"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.bairro}
                                                            onChange={(e) => setRegisterData({ ...registerData, bairro: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="cidade">Cidade</Label>
                                                    <div className="relative mt-1">
                                                        <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="cidade"
                                                            placeholder="Cidade"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.cidade}
                                                            onChange={(e) => setRegisterData({ ...registerData, cidade: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="estado">UF</Label>
                                                    <div className="relative mt-1">
                                                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                        <Input
                                                            id="estado"
                                                            placeholder="UF"
                                                            className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                            value={registerData.estado}
                                                            onChange={(e) => setRegisterData({ ...registerData, estado: e.target.value.toUpperCase() })}
                                                            maxLength={2}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                type="button"
                                                className="w-full bg-green-700 hover:bg-green-800"
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
                                                    className="text-green-700 hover:text-green-800"
                                                >
                                                    <ArrowLeft className="w-4 h-4" />
                                                </button>
                                                <span className="text-sm text-gray-500">Passo 3 de 3: Credenciais</span>
                                            </div>

                                            <div>
                                                <Label htmlFor="register-email">E-mail *</Label>
                                                <div className="relative mt-1">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="register-email"
                                                        type="email"
                                                        placeholder="seu@email.com"
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.email}
                                                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="register-password">Senha *</Label>
                                                <div className="relative mt-1">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="register-password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Mínimo 6 caracteres"
                                                        className="pl-10 pr-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.password}
                                                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor="confirm-password">Confirmar Senha *</Label>
                                                <div className="relative mt-1">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                                                    <Input
                                                        id="confirm-password"
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Confirme sua senha"
                                                        className="pl-10 h-11 border-stone-200 focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
                                                        value={registerData.confirmPassword}
                                                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                                                        required
                                                    />
                                                    {registerData.confirmPassword && registerData.password === registerData.confirmPassword && (
                                                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                                                    )}
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full bg-amber-400 hover:bg-amber-300 text-green-950 font-bold h-12 rounded-xl shadow-lg shadow-amber-400/20 text-lg transition-all hover:scale-[1.02]"
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
                                                className={`w-2 h-2 rounded-full transition-colors ${registrationStep >= step ? "bg-green-700" : "bg-gray-300"
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
                <p className="text-center text-xs text-gray-500 mt-6">
                    Ao se cadastrar, você concorda com nossos termos de uso e política de privacidade.
                </p>
            </div>
        </div>
    );
}
