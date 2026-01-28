import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { EMPRESA } from "@/config/empresa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    LogOut, User, Award, ShoppingBag, Gift, ChevronRight,
    Star, Package, Calendar, MapPin, Phone, Mail, Loader2,
    Trophy, Target, Sparkles, ArrowRight, Crown, Edit2, Save, X, Navigation, Home, Globe, Hash, Search, CreditCard
} from "lucide-react";

const LOGO_URL = EMPRESA.logo_url;
const HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop";

export default function ClienteDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [cliente, setCliente] = useState(null);
    const [vendas, setVendas] = useState([]);
    const [fidelidadeConfig, setFidelidadeConfig] = useState(null);

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        nome_completo: "",
        telefone: "",
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: ""
    });
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap');
        `;
        document.head.appendChild(style);
        checkAuth();
        return () => document.head.removeChild(style);
    }, []);

    const checkAuth = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();

            if (!authUser) {
                navigate("/cliente-login");
                return;
            }

            setUser(authUser);

            // Fetch cliente data
            const { data: clienteData, error: clienteError } = await supabase
                .from("clientes")
                .select("*")
                .eq("user_id", authUser.id)
                .maybeSingle();

            if (clienteError) {
                console.error("Erro ao buscar cliente:", clienteError);
                // Try to find by email
                const { data: clienteByEmail } = await supabase
                    .from("clientes")
                    .select("*")
                    .eq("email", authUser.email)
                    .maybeSingle();

                if (clienteByEmail) {
                    await supabase
                        .from("clientes")
                        .update({ user_id: authUser.id })
                        .eq("id", clienteByEmail.id);
                    setCliente(clienteByEmail);
                    initEditData(clienteByEmail);
                }
            } else {
                setCliente(clienteData);
                initEditData(clienteData);
            }

            // Fetch loyalty config
            const { data: configData } = await supabase
                .from("fidelidade_config")
                .select("*")
                .eq("is_active", true)
                .single();

            setFidelidadeConfig(configData);

            // Fetch purchases
            if (clienteData || cliente) {
                const clienteId = clienteData?.id || cliente?.id;
                const { data: vendasData } = await supabase
                    .from("vendas")
                    .select("*")
                    .eq("cliente_id", clienteId)
                    .order("data_venda", { ascending: false })
                    .limit(10);

                setVendas(vendasData || []);
            }
        } catch (error) {
            console.error("Erro ao verificar autenticação:", error);
        } finally {
            setLoading(false);
        }
    };

    const initEditData = (data) => {
        if (!data) {
            // Initialize with defaults if no client data
            setEditData({
                nome_completo: user?.user_metadata?.nome || "",
                telefone: "",
                cep: "",
                endereco: "",
                numero: "",
                complemento: "",
                bairro: "",
                cidade: "",
                estado: ""
            });
            return;
        }
        setEditData({
            nome_completo: data.nome_completo || "",
            telefone: data.telefone || "",
            cep: data.cep || "",
            endereco: data.endereco || data.rua || "",
            numero: data.numero || "",
            complemento: data.complemento || "",
            bairro: data.bairro || "",
            cidade: data.cidade || "",
            estado: data.estado || ""
        });
    };

    const handleSaveProfile = async () => {
        if (!user) return; // Should not happen if auth check passes
        setSavingProfile(true);

        const profileData = {
            user_id: user.id, // Ensure user_id is linked
            email: user.email, // Ensure email is present
            nome_completo: editData.nome_completo,
            telefone: editData.telefone,
            cep: editData.cep,
            endereco: editData.endereco,
            rua: editData.endereco,
            numero: editData.numero,
            complemento: editData.complemento,
            bairro: editData.bairro,
            cidade: editData.cidade,
            estado: editData.estado,
            updated_at: new Date().toISOString()
        };

        try {
            let error;
            let data;

            if (cliente?.id) {
                // Update existing
                const { error: updateError, data: updateData } = await supabase
                    .from("clientes")
                    .update(profileData)
                    .eq("id", cliente.id)
                    .select()
                    .single();
                error = updateError;
                data = updateData;
            } else {
                // Insert new (Upsert safely with user_id as key if constraint exists, or just insert)
                // Using upsert on user_id is safest if unique constraint exists
                const { error: insertError, data: insertData } = await supabase
                    .from("clientes")
                    .upsert(profileData, { onConflict: 'user_id' })
                    .select()
                    .single();
                error = insertError;
                data = insertData;
            }

            if (error) throw error;

            toast.success("Perfil atualizado com sucesso!");
            setCliente(data);
            setIsEditing(false);
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            toast.error("Erro ao atualizar perfil: " + (error.message || "Erro desconhecido"));
        } finally {
            setSavingProfile(false);
        }
    };

    const buscarCEP = async (cep) => {
        const cleanCep = cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const data = await response.json();

            if (!data.erro) {
                setEditData(prev => ({
                    ...prev,
                    endereco: data.logradouro,
                    bairro: data.bairro,
                    cidade: data.localidade,
                    estado: data.uf
                }));
            }
        } catch (error) {
            console.error("Erro ao buscar CEP:", error);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.success("Você saiu da sua conta");
        navigate("/");
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value || 0);
    };

    const formatDate = (date) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("pt-BR");
    };

    // Keep loyalty calculations
    const currentSteps = cliente?.fidelidade_steps || 0;
    const maxSteps = fidelidadeConfig?.reward_threshold || 20;
    const progressPercent = Math.min((currentSteps / maxSteps) * 100, 100);

    const milestones = [
        { steps: 5, reward: "5% de desconto" },
        { steps: 10, reward: "10% de desconto" },
        { steps: 15, reward: "Brinde surpresa" },
        { steps: maxSteps, reward: fidelidadeConfig?.reward_description || "Recompensa especial!" },
    ];

    if (loading) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 z-0 opacity-40">
                    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-emerald-100/40 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-100/40 rounded-full blur-[100px]" />
                </div>
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-white shadow-xl shadow-amber-500/10 flex items-center justify-center animate-bounce">
                        <img src={LOGO_URL} alt="Loading" className="w-10 h-10 object-contain" />
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-stone-400 mt-2">Carregando</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 font-['Lato'] text-stone-900 relative selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden">
            {/* Premium Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-emerald-100/40 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-100/40 rounded-full blur-[100px]" />
                <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-white/40 rounded-full blur-[80px]" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none" />
            </div>

            {/* Header */}
            <header className="fixed top-0 w-full z-50 border-b border-stone-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white p-2 shadow-inner border border-stone-100 flex items-center justify-center">
                            <img src={LOGO_URL} alt="Logo" className="h-full w-full object-contain" />
                        </div>
                        <div>
                            <h1 className="text-xl font-['Playfair_Display'] font-bold text-stone-900 tracking-tight">Móveis Pedro II</h1>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-bold">Portal do Cliente</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all duration-300 font-medium text-sm group"
                        >
                            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="hidden sm:inline">Sair</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 space-y-8">
                {/* Hero Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="space-y-2">
                        <h2 className="text-4xl md:text-5xl font-['Playfair_Display'] font-black text-stone-900">
                            Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-amber-500">{cliente?.nome_completo?.split(' ')[0] || user?.email?.split('@')[0]}</span>
                        </h2>
                        <p className="text-stone-500 font-medium">Bem-vindo ao seu espaço exclusivo de móveis e decorações.</p>
                    </div>

                    <div className="flex gap-4 p-1 rounded-2xl bg-white/50 border border-stone-200/50 backdrop-blur-md shadow-sm">
                        <div className="px-4 py-2 rounded-xl bg-white shadow-sm border border-stone-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                                <Crown size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Status</p>
                                <p className="text-sm font-bold text-stone-800">Membro Prime</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Loyalty Card */}
                        <div className="relative group overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-stone-900 to-black p-8 text-white shadow-2xl transition-all duration-500 hover:shadow-amber-900/10">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700 group-hover:rotate-12" aria-hidden="true">
                                <Crown size={180} />
                            </div>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />

                            <div className="relative z-10 flex flex-col h-full justify-between gap-12">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                                            <Sparkles size={12} />
                                            Programa de Fidelidade
                                        </div>
                                        <h3 className="text-3xl font-['Playfair_Display'] font-bold">Cartão Coroas Gold</h3>
                                    </div>
                                    <div className="w-16 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/50">
                                        <div className="w-8 h-6 border-[1.5px] border-white/30 rounded flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white/20 rounded-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-stone-400 text-xs font-bold uppercase tracking-[.2em] mb-1">Saldo Atual</p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-5xl font-black font-['Playfair_Display'] text-amber-400">{cliente?.fidelidade_steps || 0}</span>
                                                <span className="text-amber-500/50 font-bold uppercase tracking-widest text-sm">Coroas</span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-stone-400 text-xs font-bold uppercase tracking-[.2em] mb-1">Próxima Recompensa</p>
                                            <p className="text-xs font-medium text-stone-300">
                                                Resgate com {fidelidadeConfig?.reward_threshold || 10} coroas
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="h-4 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[2px]">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 rounded-full transition-all duration-1000 relative group"
                                                style={{ width: `${Math.min((cliente?.fidelidade_steps || 0) / (fidelidadeConfig?.reward_threshold || 10) * 100, 100)}%` }}
                                            >
                                                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:50px_50px] animate-[shimmer_2s_infinite]" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                            <span>Início</span>
                                            <span className="text-amber-500">{Math.max(0, (fidelidadeConfig?.reward_threshold || 10) - (cliente?.fidelidade_steps || 0))} Coroas para o Próximo Nível</span>
                                            <span>Master</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { label: 'Total Gasto', value: formatCurrency(vendas.reduce((acc, p) => acc + (p.valor_total || 0), 0)), icon: ShoppingBag },
                                { label: 'Mensagens', value: '0', icon: Mail },
                                { label: 'Cupons', value: '3 ativos', icon: Gift }
                            ].map((stat, i) => (
                                <div key={i} className="group p-6 rounded-[2rem] bg-white border border-stone-200/60 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-stone-200/50">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-600 group-hover:scale-110 transition-transform">
                                            <stat.icon size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">{stat.label}</p>
                                            <p className="text-lg font-bold text-stone-800">{stat.value}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Rewards List */}
                        <div className="p-8 rounded-[2.5rem] bg-white border border-stone-200/60 shadow-sm">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-2 rounded-lg bg-stone-50">
                                    <Star className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold font-['Playfair_Display'] text-stone-900">Níveis de Recompensa</h3>
                                    <p className="text-xs text-stone-500">Acumule coroas e desbloqueie benefícios</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {milestones.map((milestone, index) => {
                                    const unlocked = currentSteps >= milestone.steps;
                                    return (
                                        <div
                                            key={index}
                                            className={`relative p-5 rounded-2xl flex items-center gap-5 transition-all duration-500 border
                                                ${unlocked ? "bg-gradient-to-r from-amber-500/5 to-transparent border-amber-500/20" : "bg-stone-50 border-stone-100 opacity-60"}
                                            `}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0
                                                ${unlocked ? "bg-amber-500 text-white border-amber-500 shadow-md" : "bg-white text-stone-300 border-stone-200"}
                                            `}>
                                                {unlocked ? <Crown size={16} /> : <span className="font-bold text-xs">{milestone.steps}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${unlocked ? "text-stone-900" : "text-stone-400"}`}>{milestone.reward}</p>
                                                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mt-0.5">{milestone.steps} Coroas</p>
                                            </div>
                                            {unlocked && <Sparkles className="absolute top-4 right-4 w-4 h-4 text-amber-500/50 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Activity History */}
                        <div className="p-8 rounded-[2.5rem] bg-white border border-stone-200/60 shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-50 text-stone-600 flex items-center justify-center shadow-inner border border-stone-100">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold font-['Playfair_Display'] text-stone-900">Histórico de Pedidos</h3>
                                        <p className="text-xs text-stone-500">Documentação das suas compras recentes</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-stone-100">
                                            <th className="pb-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">Pedido ID</th>
                                            <th className="pb-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">Data</th>
                                            <th className="pb-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">Valor</th>
                                            <th className="pb-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {vendas.length > 0 ? vendas.map((p) => (
                                            <tr key={p.id} className="group hover:bg-stone-50 transition-colors">
                                                <td className="py-5 px-4 font-mono text-sm text-amber-600 font-bold">#{p.id.slice(0, 8)}</td>
                                                <td className="py-5 px-4">
                                                    <div className="flex items-center gap-2 text-stone-900 font-medium">
                                                        <Calendar size={14} className="text-stone-400" />
                                                        {new Date(p.data_venda || p.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-4 font-bold text-stone-900">{formatCurrency(p.valor_total)}</td>
                                                <td className="py-5 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.status === 'Concluído' || p.status === 'Concluída' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                        }`}>
                                                        {p.status || 'Pendente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="py-12 text-center text-stone-400 text-sm italic">Nenhum pedido encontrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        {/* Profile Summary */}
                        <div className="p-8 rounded-[2.5rem] bg-white border border-stone-200/60 shadow-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 translate-x-4 -translate-y-4 opacity-5 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500">
                                <User size={120} />
                            </div>

                            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                <div className="w-24 h-24 rounded-[2rem] bg-stone-50 p-2 shadow-inner border border-stone-100 relative">
                                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-stone-400 text-3xl font-bold">
                                        {cliente?.nome_completo?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-500 text-white shadow-xl shadow-amber-500/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                                <div className="space-y-1 overflow-hidden w-full">
                                    <h4 className="text-2xl font-bold font-['Playfair_Display'] text-stone-900 truncate">{cliente?.nome_completo || 'Completar Perfil'}</h4>
                                    <p className="text-xs text-stone-500 font-medium truncate">{user?.email}</p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <Phone size={12} className="text-amber-500" />
                                        Telefone
                                    </p>
                                    <p className="text-sm font-bold text-stone-800">{cliente?.telefone || '-'}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <MapPin size={12} className="text-amber-500" />
                                        Localização
                                    </p>
                                    <p className="text-sm font-bold text-stone-800 truncate">{cliente?.cidade ? `${cliente.cidade} - ${cliente.estado}` : '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Marketing Card */}
                        <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-stone-800 to-stone-950 text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                <Gift size={100} />
                            </div>
                            <div className="relative z-10 space-y-6">
                                <div className="space-y-2">
                                    <h4 className="text-xl font-bold font-['Playfair_Display']">Acesso Exclusivo</h4>
                                    <p className="text-xs text-stone-400 leading-relaxed">Como membro Premium, você tem acesso antecipado ao nosso novo catálogo de Outono/Inverno.</p>
                                </div>
                                <button className="w-full py-3 bg-white text-stone-900 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group">
                                    Ver Catálogo
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Support Card */}
                        <div className="p-8 rounded-[2.5rem] bg-white border border-stone-200/60 shadow-sm flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Phone size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-lg font-bold text-stone-900">Precisa de Ajuda?</h4>
                                <p className="text-xs text-stone-500">Nossa equipe está disponível para te atender.</p>
                            </div>
                            <button className="text-emerald-600 font-bold text-sm hover:underline">Falar com Consultor</button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Profile Edit Dialog */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" onClick={() => setIsEditing(false)} />
                    <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Edit2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold font-['Playfair_Display'] text-stone-900">Editar Perfil</h3>
                                        <p className="text-xs text-stone-500">Mantenha seus dados atualizados</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(false)} className="p-3 rounded-full hover:bg-stone-50 transition-colors text-stone-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2 px-1 bg-white inline-block">Nome Completo</Label>
                                    <Input
                                        type="text"
                                        value={editData.nome_completo}
                                        onChange={(e) => setEditData({ ...editData, nome_completo: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all font-medium h-auto"
                                        placeholder="Seu nome"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">Telefone</Label>
                                    <Input
                                        type="text"
                                        value={editData.telefone}
                                        onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all font-medium h-auto"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">CEP</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={editData.cep}
                                            onChange={(e) => setEditData({ ...editData, cep: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 h-auto"
                                            placeholder="00000-000"
                                        />
                                        <button onClick={() => buscarCEP(editData.cep)} className="p-4 rounded-2xl bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors">
                                            <Search size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">Cidade</Label>
                                    <Input readOnly value={editData.cidade} className="w-full px-5 py-4 rounded-2xl bg-stone-100 border border-stone-200 text-stone-400 font-medium cursor-not-allowed h-auto" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">UF</Label>
                                    <Input readOnly value={editData.estado} className="w-full px-5 py-4 rounded-2xl bg-stone-100 border border-stone-200 text-stone-400 font-medium cursor-not-allowed h-auto" />
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">Endereço (Rua)</Label>
                                    <Input
                                        type="text"
                                        value={editData.endereco}
                                        onChange={(e) => setEditData({ ...editData, endereco: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium h-auto"
                                        placeholder="Rua..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">Número</Label>
                                    <Input
                                        type="text"
                                        value={editData.numero}
                                        onChange={(e) => setEditData({ ...editData, numero: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium text-center h-auto"
                                        placeholder="Nº"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-2">Bairro</Label>
                                    <Input
                                        type="text"
                                        value={editData.bairro}
                                        onChange={(e) => setEditData({ ...editData, bairro: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium h-auto"
                                        placeholder="Bairro"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className="w-full py-5 rounded-[1.5rem] bg-stone-900 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-stone-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {savingProfile ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                                {savingProfile ? 'Salvando...' : 'Confirmar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
