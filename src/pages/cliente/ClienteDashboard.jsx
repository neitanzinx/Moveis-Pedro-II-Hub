import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/api/base44Client";
import { resgatarCoroasDesconto, buscarHistoricoCliente, formatarTipoEvento } from "@/utils/fidelidadeEngine";
import { ensureClientPortalSession, markClientSessionAlive, trackClientAccessEvent } from "@/lib/clienteAccessTracking";
import { useTenant } from "@/contexts/TenantContext";
import { getPortalTheme } from "@/config/portalThemes";
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
    Trophy, Target, Sparkles, ArrowRight, Crown, Edit2, Save, X, Navigation, Home, Globe, Hash, Search, CreditCard, Store, AlertCircle
} from "lucide-react";

const HERO_IMAGE = "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop";

export default function ClienteDashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const { organization, settings, brandName, brandLogo } = useTenant();

    const themeId = settings?.portal_theme || settings?.modulos_ativos?.portal_theme || "luxo";
    const portalTheme = getPortalTheme(themeId).dashboard;

    const isFidelidadeActive = settings?.modulos_ativos ? settings.modulos_ativos.fidelidade !== false : true;
    const isPedidosActive = settings?.modulos_ativos ? settings.modulos_ativos.meus_pedidos !== false : true;
    const isAutoatendimentoActive = settings?.modulos_ativos ? settings.modulos_ativos.autoatendimento !== false : true;

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [cliente, setCliente] = useState(null);
    const [vendas, setVendas] = useState([]);
    const [fidelidadeConfig, setFidelidadeConfig] = useState(null);
    const [accessSessionId, setAccessSessionId] = useState(null);

    // Redeem State
    const [coroasParaResgatar, setCoroasParaResgatar] = useState("");
    const [resgatando, setResgatando] = useState(false);
    const [historicoCoroas, setHistoricoCoroas] = useState([]);

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
            const { data: { session } } = await supabase.auth.getSession();
            const authUser = session?.user;

            if (!authUser) {
                navigate("/cliente-login");
                return;
            }

            setUser(authUser);

            // Fetch cliente data
            let resolvedCliente = null;
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
                    resolvedCliente = clienteByEmail;
                }
            } else {
                resolvedCliente = clienteData;
            }

            setCliente(resolvedCliente);
            initEditData(resolvedCliente, authUser);

            const accessSession = await ensureClientPortalSession({
                authUserId: authUser.id,
                clienteId: resolvedCliente?.id,
                pagePath: location.pathname,
            });

            if (accessSession?.sessionId) {
                setAccessSessionId(accessSession.sessionId);
                await trackClientAccessEvent({
                    sessionId: accessSession.sessionId,
                    authUserId: authUser.id,
                    clienteId: resolvedCliente?.id,
                    eventName: "dashboard_view",
                    eventCategory: "navigation",
                    pagePath: location.pathname,
                    dedupeKey: `dashboard_view_${authUser.id}`,
                    metadata: { source: "portal_cliente" },
                });
            }

            // Fetch loyalty config
            let fidelidadeQuery = supabase
                .from("fidelidade_config")
                .select("*")
                .eq("is_active", true);

            if (organization?.id) {
                fidelidadeQuery = fidelidadeQuery.eq("organization_id", organization.id);
            }

            const { data: configData } = await fidelidadeQuery.maybeSingle();
            setFidelidadeConfig(configData);

            // Fetch purchases — usa resolvedCliente diretamente (estado React ainda não re-renderizou)
            if (resolvedCliente?.id) {
                let vendasQuery = supabase
                    .from("vendas")
                    .select("*")
                    .eq("cliente_id", resolvedCliente.id);

                if (organization?.id) {
                    vendasQuery = vendasQuery.eq("organization_id", organization.id);
                }

                const { data: vendasData } = await vendasQuery
                    .order("data_venda", { ascending: false })
                    .limit(10);

                setVendas(vendasData || []);


                // Fetch coroas history
                try {
                    const hist = await buscarHistoricoCliente(resolvedCliente.id, 10);
                    setHistoricoCoroas(hist || []);
                } catch (e) { /* silently fail */ }
            }
        } catch (error) {
            console.error("Erro ao verificar autenticação:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!accessSessionId || !user?.id) return;

        const heartbeat = () => markClientSessionAlive(accessSessionId, user.id, cliente?.id);

        const intervalId = window.setInterval(heartbeat, 60 * 1000);

        const onVisibilityChange = () => {
            if (!document.hidden) {
                heartbeat();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [accessSessionId, user?.id, cliente?.id]);

    const initEditData = (data, authUser) => {
        if (!data) {
            // Initialize with defaults if no client data
            setEditData({
                nome_completo: authUser?.user_metadata?.nome || "",
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
            if (accessSessionId && user?.id) {
                await trackClientAccessEvent({
                    sessionId: accessSessionId,
                    authUserId: user.id,
                    clienteId: data?.id || cliente?.id,
                    eventName: "profile_saved",
                    eventCategory: "profile",
                    pagePath: location.pathname,
                    metadata: { updated_fields: Object.keys(editData).filter((key) => !!editData[key]) },
                    dedupeKey: `profile_saved_${user.id}`,
                });
            }
            setIsEditing(false);
        } catch (error) {
            console.error("Erro ao atualizar perfil:", error);
            toast.error("Erro ao atualizar perfil: " + (error.message || "Erro desconhecido"));
        } finally {
            setSavingProfile(false);
        }
    };

    const handleResgatarDesconto = async () => {
        const qty = parseInt(coroasParaResgatar);
        if (!qty || qty < 1) { toast.error("Informe a quantidade de Coroas"); return; }
        if (!cliente) return;
        setResgatando(true);
        try {
            const resultado = await resgatarCoroasDesconto(cliente, qty);
            if (resultado.sucesso) {
                toast.success(`Cupom gerado: ${resultado.cupom} — R$ ${resultado.valorDesconto.toFixed(2)} de desconto!`);
                // Refresh cliente data
                const { data: updatedCliente } = await supabase.from("clientes").select("*").eq("id", cliente.id).single();
                if (updatedCliente) setCliente(updatedCliente);
                const hist = await buscarHistoricoCliente(cliente.id, 10);
                setHistoricoCoroas(hist || []);
                setCoroasParaResgatar("");
            } else {
                toast.error(resultado.mensagem || "Erro ao resgatar");
            }
        } catch (e) { toast.error("Erro ao resgatar: " + e.message); }
        finally { setResgatando(false); }
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
        if (accessSessionId && user?.id) {
            await trackClientAccessEvent({
                sessionId: accessSessionId,
                authUserId: user.id,
                clienteId: cliente?.id,
                eventName: "logout",
                eventCategory: "auth",
                pagePath: location.pathname,
                metadata: { trigger: "manual" },
            });
        }
        await supabase.auth.signOut();
        toast.success("Você saiu da sua conta");
        navigate("/");
    };

    const openProfileEditor = async () => {
        setIsEditing(true);
        if (accessSessionId && user?.id) {
            await trackClientAccessEvent({
                sessionId: accessSessionId,
                authUserId: user.id,
                clienteId: cliente?.id,
                eventName: "profile_edit_opened",
                eventCategory: "profile",
                pagePath: location.pathname,
                dedupeKey: `profile_edit_opened_${user.id}`,
            });
        }
    };

    const openAutoAtendimento = async () => {
        if (accessSessionId && user?.id) {
            await trackClientAccessEvent({
                sessionId: accessSessionId,
                authUserId: user.id,
                clienteId: cliente?.id,
                eventName: "support_auto_atendimento_opened",
                eventCategory: "support",
                pagePath: location.pathname,
                dedupeKey: `support_auto_atendimento_opened_${user.id}`,
            });
        }
        navigate("/assistencia/auto");
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
    const currentSteps = cliente?.coroas || 0;
    const maxSteps = fidelidadeConfig?.reward_threshold || 20;
    const progressPercent = Math.min((currentSteps / maxSteps) * 100, 100);

    const statusMembro = currentSteps >= maxSteps
        ? "Membro Coroa Ouro"
        : currentSteps >= Math.ceil(maxSteps * 0.5)
            ? "Membro Coroa Prata"
            : "Membro Coroa Bronze";

    // Client profile validity checks
    const rawName = cliente?.nome_completo;
    const isNameValid = rawName && !rawName.includes('@') && rawName.trim().length > 0;
    const displayName = isNameValid 
        ? rawName.split(' ')[0] 
        : (user?.user_metadata?.nome && !user.user_metadata.nome.includes('@') ? user.user_metadata.nome.split(' ')[0] : 'Cliente');

    const isIncompleteProfile = !cliente || 
        !isNameValid || 
        !cliente?.telefone || 
        cliente.telefone === '-' ||
        (!cliente.cpf && !cliente.cnpj);

    const milestones = [
        { steps: firstMilestone, reward: `${firstMilestone} coroas acumuladas` },
        { steps: secondMilestone, reward: `${secondMilestone} coroas acumuladas` },
        { steps: thirdMilestone, reward: `${thirdMilestone} coroas acumuladas` },
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
                        {brandLogo ? (
                            <img src={brandLogo} alt={brandName} className="w-10 h-10 object-contain" />
                        ) : (
                            <Store className="w-8 h-8 text-amber-600" />
                        )}
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
        <div className={`min-h-screen font-sans relative selection:bg-amber-100 overflow-x-hidden ${portalTheme.bg}`}>
            {/* Header */}
            <header className={`fixed top-0 w-full z-50 border-b ${portalTheme.headerBg}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white/10 p-2 shadow-inner border border-white/10 flex items-center justify-center">
                            {brandLogo ? (
                                <img src={brandLogo} alt={brandName} className="h-full w-full object-contain" />
                            ) : (
                                <Store className={`h-6 w-6 ${portalTheme.accentText}`} />
                            )}
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold tracking-tight ${portalTheme.textHeading}`}>{brandName}</h1>
                            <p className={`text-[10px] uppercase tracking-[0.2em] font-bold ${portalTheme.accentText}`}>Portal do Cliente</p>
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
                        <h2 className="text-4xl md:text-5xl font-['Playfair_Display'] font-black text-stone-100">
                            Olá, <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">{displayName}</span>
                        </h2>
                        <p className="text-stone-300 font-medium">
                            {isIncompleteProfile ? "Complete o seu cadastro para aproveitar todas as vantagens do portal." : "Bem-vindo ao seu espaço exclusivo de móveis e decorações."}
                        </p>
                    </div>

                    <div className="flex gap-4 p-1 rounded-2xl bg-stone-900/80 border border-amber-900/40 backdrop-blur-md shadow-lg">
                        <div className="px-4 py-2 rounded-xl bg-stone-950/60 border border-amber-900/30 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                                <Crown size={20} />
                            </div>
                            <div>
                                <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">Status</p>
                                <p className="text-sm font-bold text-amber-100">{statusMembro}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Incomplete Profile Alert Banner */}
                {isIncompleteProfile && (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-stone-900/90 to-amber-950/80 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md shadow-xl animate-pulse-subtle">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold shadow-lg shadow-amber-500/20">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h4 className="font-bold text-amber-200 text-sm">Seu cadastro está incompleto</h4>
                                <p className="text-xs text-stone-300">Cadastre seu nome completo e telefone para liberar resgates de coroas e histórico de compras.</p>
                            </div>
                        </div>
                        <button
                            onClick={openProfileEditor}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 text-xs font-bold shrink-0 transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
                        >
                            <Edit2 size={14} /> Complete seu Perfil
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Loyalty Card */}
                        {isFidelidadeActive && (
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
                                        <h3 className="text-3xl font-['Playfair_Display'] font-bold">Programa Coroas</h3>
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
                                                <span className="text-5xl font-black font-['Playfair_Display'] text-amber-400">{cliente?.coroas || 0}</span>
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
                                                style={{ width: `${Math.min((cliente?.coroas || 0) / (fidelidadeConfig?.reward_threshold || 10) * 100, 100)}%` }}
                                            >
                                                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:50px_50px] animate-[shimmer_2s_infinite]" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                                            <span>Início</span>
                                            <span className="text-amber-500">{Math.max(0, (fidelidadeConfig?.reward_threshold || 10) - (cliente?.coroas || 0))} Coroas para o Próximo Nível</span>
                                            <span>Ouro</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Redemption Card */}
                        {(cliente?.coroas || 0) >= (fidelidadeConfig?.reward_threshold || 100) && (
                            <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-amber-50 to-white border border-amber-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600"><Gift size={20} /></div>
                                    <div>
                                        <h3 className="font-bold text-stone-900">Resgatar Coroas</h3>
                                        <p className="text-xs text-stone-500">Converta Coroas em desconto na sua proxima compra</p>
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <div className="flex-1">
                                        <label className="text-xs text-stone-500 font-bold uppercase tracking-wide block mb-1">Quantidade de Coroas</label>
                                        <input type="number" min={fidelidadeConfig?.reward_threshold || 100} max={cliente?.coroas || 0}
                                            value={coroasParaResgatar} onChange={(e) => setCoroasParaResgatar(e.target.value)}
                                            placeholder={`Min: ${fidelidadeConfig?.reward_threshold || 100}`}
                                            className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                                    </div>
                                    {coroasParaResgatar && parseInt(coroasParaResgatar) > 0 && (
                                        <div className="text-right">
                                            <p className="text-xs text-stone-400">Valor</p>
                                            <p className="font-bold text-green-600">R$ {((parseInt(coroasParaResgatar) || 0) * (fidelidadeConfig?.desconto_por_coroa || 0.10)).toFixed(2)}</p>
                                        </div>
                                    )}
                                    <button onClick={handleResgatarDesconto} disabled={resgatando || !coroasParaResgatar}
                                        className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 flex items-center gap-2"
                                        style={{ backgroundColor: "#07593f" }}>
                                        {resgatando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        Gerar Cupom
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Coroas History */}
                        {historicoCoroas.length > 0 && (
                            <div className="p-6 rounded-[2rem] bg-white border border-stone-200/60 shadow-sm">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-500"><Crown size={20} /></div>
                                    <h3 className="font-bold text-stone-900">Historico de Coroas</h3>
                                </div>
                                <div className="divide-y divide-stone-50">
                                    {historicoCoroas.map((h) => (
                                        <div key={h.id} className="flex items-center justify-between py-3">
                                            <div>
                                                <p className="text-sm font-medium text-stone-800">{formatarTipoEvento(h.tipo_evento)}</p>
                                                <p className="text-xs text-stone-400">{new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                                            </div>
                                            <span className={`font-bold text-sm ${h.coroas > 0 ? "text-green-600" : "text-red-500"}`}>
                                                {h.coroas > 0 ? "+" : ""}{h.coroas}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { label: 'Total Gasto', value: formatCurrency(vendas.reduce((acc, p) => acc + (p.valor_total || 0), 0)), icon: ShoppingBag },
                                { label: 'Pedidos', value: String(vendas.length), icon: Package },
                                { label: 'Coroas', value: String(cliente?.coroas || 0), icon: Crown }
                            ].map((stat, i) => (
                                <div key={i} className="group p-6 rounded-[2rem] bg-stone-900/60 border border-amber-900/30 text-stone-100 shadow-xl transition-all duration-500 hover:border-amber-500/40">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                                            <stat.icon size={24} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">{stat.label}</p>
                                            <p className="text-lg font-bold text-stone-100">{stat.value}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Rewards List */}
                        <div className="p-8 rounded-[2.5rem] bg-stone-900/60 border border-amber-900/30 text-stone-100 shadow-xl">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                    <Star className="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold font-['Playfair_Display'] text-amber-100">Níveis de Recompensa</h3>
                                    <p className="text-xs text-stone-400">Acumule coroas e desbloqueie benefícios</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {milestones.map((milestone, index) => {
                                    const unlocked = currentSteps >= milestone.steps;
                                    return (
                                        <div
                                            key={index}
                                            className={`relative p-5 rounded-2xl flex items-center gap-5 transition-all duration-500 border
                                                ${unlocked ? "bg-gradient-to-r from-amber-500/10 to-stone-900 border-amber-500/30" : "bg-stone-950/40 border-stone-800 opacity-60"}
                                            `}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0
                                                ${unlocked ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md font-bold" : "bg-stone-900 text-stone-500 border-stone-700"}
                                            `}>
                                                {unlocked ? <Crown size={16} /> : <span className="font-bold text-xs">{milestone.steps}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${unlocked ? "text-amber-100" : "text-stone-400"}`}>{milestone.reward}</p>
                                                <p className="text-[10px] text-amber-400/70 uppercase tracking-widest font-bold mt-0.5">{milestone.steps} Coroas</p>
                                            </div>
                                            {unlocked && <Sparkles className="absolute top-4 right-4 w-4 h-4 text-amber-400/50 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        )}

                        {/* Activity History */}
                        {isPedidosActive && (
                        <div className="p-8 rounded-[2.5rem] bg-stone-900/60 border border-amber-900/30 text-stone-100 shadow-xl overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold font-['Playfair_Display'] text-amber-100">Histórico de Pedidos</h3>
                                        <p className="text-xs text-stone-400">Documentação das suas compras recentes</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-amber-900/30">
                                            <th className="pb-4 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest px-4">Pedido ID</th>
                                            <th className="pb-4 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest px-4">Data</th>
                                            <th className="pb-4 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest px-4">Valor</th>
                                            <th className="pb-4 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-900/20">
                                        {vendas.length > 0 ? vendas.map((p) => (
                                            <tr key={p.id} className="group hover:bg-amber-950/30 transition-colors">
                                                <td className="py-5 px-4 font-mono text-sm text-amber-400 font-bold">#{p.id.slice(0, 8)}</td>
                                                <td className="py-5 px-4">
                                                    <div className="flex items-center gap-2 text-stone-200 font-medium">
                                                        <Calendar size={14} className="text-stone-400" />
                                                        {new Date(p.data_venda || p.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="py-5 px-4 font-bold text-amber-100">{formatCurrency(p.valor_total)}</td>
                                                <td className="py-5 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${p.status === 'Concluído' || p.status === 'Concluída' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
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
                        )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-8">
                        {/* Profile Summary */}
                        <div className="p-8 rounded-[2.5rem] bg-stone-900/60 border border-amber-900/30 text-stone-100 shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 translate-x-4 -translate-y-4 opacity-5 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500">
                                <User size={120} />
                            </div>

                            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                <div className="w-24 h-24 rounded-[2rem] bg-stone-950 p-2 shadow-inner border border-amber-900/40 relative">
                                    <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-950 to-stone-900 flex items-center justify-center text-amber-400 text-3xl font-bold border border-amber-500/20">
                                        {isNameValid ? cliente.nome_completo.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'C')}
                                    </div>
                                    <button
                                        onClick={openProfileEditor}
                                        className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-500 text-stone-950 shadow-xl shadow-amber-500/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all font-bold"
                                        title="Editar Perfil"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                </div>
                                <div className="space-y-1 overflow-hidden w-full">
                                    <h4 className="text-2xl font-bold font-['Playfair_Display'] text-amber-100 truncate">
                                        {isNameValid ? cliente.nome_completo : 'Completar Perfil'}
                                    </h4>
                                    <p className="text-xs text-stone-400 font-medium truncate">{user?.email}</p>

                                    {isIncompleteProfile && (
                                        <div className="inline-block mt-2">
                                            <button 
                                                onClick={openProfileEditor}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all"
                                            >
                                                <AlertCircle size={12} /> Cadastro Incompleto
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="p-4 rounded-2xl bg-stone-950/60 border border-amber-900/30">
                                    <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <Phone size={12} className="text-amber-500" />
                                        Telefone
                                    </p>
                                    <p className="text-sm font-bold text-stone-200">{cliente?.telefone || '-'}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-stone-950/60 border border-amber-900/30">
                                    <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                        <MapPin size={12} className="text-amber-500" />
                                        Localização
                                    </p>
                                    <p className="text-sm font-bold text-stone-200 truncate">{cliente?.cidade ? `${cliente.cidade} - ${cliente.estado}` : '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Support Card */}
                        {isAutoatendimentoActive && (
                        <div className="p-8 rounded-[2.5rem] bg-stone-900/60 border border-amber-900/30 text-stone-100 shadow-xl flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <Phone size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-lg font-bold text-amber-100">Precisa de Ajuda?</h4>
                                <p className="text-xs text-stone-400">Nossa equipe está disponível para te atender.</p>
                            </div>
                            <button
                                className="text-emerald-400 font-bold text-sm hover:underline flex items-center gap-1"
                                onClick={openAutoAtendimento}
                            >
                                Abrir Autoatendimento
                            </button>
                        </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Profile Edit Dialog */}
            {isEditing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-md" onClick={() => setIsEditing(false)} />
                    <div className="relative w-full max-w-xl bg-stone-900 rounded-[2.5rem] shadow-2xl border border-amber-900/40 text-stone-100 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                        <Edit2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold font-['Playfair_Display'] text-amber-100">Completar Perfil</h3>
                                        <p className="text-xs text-stone-400">Preencha seus dados para ter a melhor experiência</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(false)} className="p-3 rounded-full hover:bg-stone-800 transition-colors text-stone-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2 px-1 bg-stone-900 inline-block">Nome Completo *</Label>
                                    <Input
                                        type="text"
                                        value={editData.nome_completo}
                                        onChange={(e) => setEditData({ ...editData, nome_completo: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium h-auto placeholder:text-stone-600"
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">Telefone *</Label>
                                    <Input
                                        type="text"
                                        value={editData.telefone}
                                        onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium h-auto placeholder:text-stone-600"
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">CEP</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={editData.cep}
                                            onChange={(e) => setEditData({ ...editData, cep: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 h-auto placeholder:text-stone-600"
                                            placeholder="00000-000"
                                        />
                                        <button onClick={() => buscarCEP(editData.cep)} className="p-4 rounded-2xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors">
                                            <Search size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">Cidade</Label>
                                    <Input readOnly value={editData.cidade} className="w-full px-5 py-4 rounded-2xl bg-stone-950/60 border border-stone-800 text-stone-400 font-medium cursor-not-allowed h-auto" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">UF</Label>
                                    <Input readOnly value={editData.estado} className="w-full px-5 py-4 rounded-2xl bg-stone-950/60 border border-stone-800 text-stone-400 font-medium cursor-not-allowed h-auto" />
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">Endereço (Rua)</Label>
                                    <Input
                                        type="text"
                                        value={editData.endereco}
                                        onChange={(e) => setEditData({ ...editData, endereco: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all font-medium h-auto placeholder:text-stone-600"
                                        placeholder="Rua..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">Número</Label>
                                    <Input
                                        type="text"
                                        value={editData.numero}
                                        onChange={(e) => setEditData({ ...editData, numero: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all font-medium text-center h-auto placeholder:text-stone-600"
                                        placeholder="Nº"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest ml-2">Bairro</Label>
                                    <Input
                                        type="text"
                                        value={editData.bairro}
                                        onChange={(e) => setEditData({ ...editData, bairro: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl bg-stone-950 border border-amber-900/40 text-stone-100 focus:outline-none focus:ring-4 focus:ring-amber-500/20 transition-all font-medium h-auto placeholder:text-stone-600"
                                        placeholder="Bairro"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 font-black uppercase tracking-[0.2em] shadow-2xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
