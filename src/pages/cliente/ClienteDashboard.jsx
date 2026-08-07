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
    const [tiers, setTiers] = useState([]);
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

            if (!clienteData && authUser.email) {
                // Try to find by email if user_id wasn't linked yet
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
                    resolvedCliente = { ...clienteByEmail, user_id: authUser.id };
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

            // Fetch tiers
            try {
                const { data: tiersData } = await supabase
                    .from("fidelidade_tiers")
                    .select("*")
                    .eq("is_active", true)
                    .order("coroas_minimas", { ascending: true });
                setTiers(tiersData || []);
            } catch (_) { /* silently fail */ }

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
            organization_id: cliente?.organization_id || organization?.id || null, // Include organization_id for SaaS RLS
            user_id: user.id, // Ensure user_id is linked
            created_by: user.id, // RLS might require created_by to match auth.uid()
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
            estado: editData.estado
        };

        try {
            let error;
            let data;

            let existingId = cliente?.id;
            if (!existingId) {
                const { data: existingClient } = await supabase
                    .from("clientes")
                    .select("id")
                    .or(`user_id.eq.${user.id},email.eq.${user.email}`)
                    .maybeSingle();
                if (existingClient?.id) {
                    existingId = existingClient.id;
                }
            }

            if (existingId) {
                // Update existing
                const { error: updateError, data: updateData } = await supabase
                    .from("clientes")
                    .update(profileData)
                    .eq("id", existingId)
                    .select()
                    .single();
                error = updateError;
                data = updateData;
            } else {
                // Insert new 
                const { error: insertError, data: insertData } = await supabase
                    .from("clientes")
                    .insert(profileData)
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

    // Loyalty calculations
    const saldoCoroas = cliente?.coroas || 0;

    // Calcular tier atual e próximo tier a partir dos tiers cadastrados no banco
    const sortedTiers = Array.isArray(tiers) && tiers.length > 0
        ? [...tiers].sort((a, b) => (a.coroas_minimas || 0) - (b.coroas_minimas || 0))
        : [];

    let currentTier = null;
    let nextTier = null;

    if (sortedTiers.length > 0) {
        for (let i = 0; i < sortedTiers.length; i++) {
            if (saldoCoroas >= (sortedTiers[i].coroas_minimas || 0)) {
                currentTier = sortedTiers[i];
            } else if (!nextTier) {
                nextTier = sortedTiers[i];
            }
        }
    }

    const hasNextTier = Boolean(nextTier && nextTier.coroas_minimas > saldoCoroas);
    const coroasParaProximoNivel = hasNextTier ? nextTier.coroas_minimas - saldoCoroas : 0;
    const hasConfiguredReward = Boolean(fidelidadeConfig?.reward_threshold && fidelidadeConfig.reward_threshold > 0);
    const rewardThreshold = hasConfiguredReward ? fidelidadeConfig.reward_threshold : null;

    // Barra de progresso e rótulos dinâmicos
    let progressPercent = 0;
    let progressLabelLeft = currentTier?.nome ? currentTier.nome.toUpperCase() : "INÍCIO";
    let progressLabelCenter = "";
    let progressLabelRight = "";

    if (hasNextTier) {
        const baseMin = currentTier ? (currentTier.coroas_minimas || 0) : 0;
        const targetMax = nextTier.coroas_minimas;
        const diff = targetMax - baseMin;
        progressPercent = diff > 0 
            ? Math.min(100, Math.max(5, ((saldoCoroas - baseMin) / diff) * 100))
            : 100;
        progressLabelCenter = `${coroasParaProximoNivel} Coroas para o nível ${nextTier.nome}`;
        progressLabelRight = nextTier.nome.toUpperCase();
    } else if (hasConfiguredReward) {
        progressPercent = Math.min(100, Math.max(5, (saldoCoroas / rewardThreshold) * 100));
        const faltam = Math.max(0, rewardThreshold - saldoCoroas);
        progressLabelCenter = faltam > 0 ? `${faltam} Coroas para resgate` : "Recompensa disponível!";
        progressLabelRight = "RESGATE";
    } else {
        // Quando o próximo nível ou recompensa ainda não foram definidos
        progressPercent = saldoCoroas > 0 ? 100 : 0;
        progressLabelLeft = "SALDO ATIVO";
        progressLabelCenter = `${saldoCoroas} ${saldoCoroas === 1 ? 'Coroa acumulada' : 'Coroas acumuladas'}`;
        progressLabelRight = currentTier?.nome ? currentTier.nome.toUpperCase() : "FIDELIDADE";
    }

    // Nível atual / status do membro
    const statusMembro = currentTier?.nome
        ? `Membro Coroa ${currentTier.nome}`
        : "Membro Fidelidade";

    // Milestones / Níveis de recompensa do programa
    const currentSteps = saldoCoroas;
    const defaultMilestones = [
        { steps: 50, reward: "Cupom de R$ 50 de Desconto" },
        { steps: 100, reward: "Frete Grátis na Próxima Compra" },
        { steps: 200, reward: "Brinde Especial da Linha Conforto" },
        { steps: 500, reward: "Acesso a Ofertas Exclusivas VIP" },
    ];
    const milestones = sortedTiers.length > 0
        ? sortedTiers.map(t => ({
            steps: t.coroas_minimas || 0,
            reward: t.beneficio || `Nível ${t.nome} Desbloqueado`
        }))
        : defaultMilestones;

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

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${portalTheme.bg}`}>
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-white/10 shadow-xl flex items-center justify-center animate-bounce border border-white/20">
                        {brandLogo ? (
                            <img src={brandLogo} alt={brandName} className="w-10 h-10 object-contain" />
                        ) : (
                            <Store className={`w-8 h-8 ${portalTheme.accentText}`} />
                        )}
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex gap-1">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </div>
                        <p className={`text-[10px] uppercase tracking-[0.3em] font-bold mt-2 ${portalTheme.textMuted}`}>Carregando Portal</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen font-sans relative selection:bg-amber-500/20 overflow-x-hidden ${portalTheme.bg}`}>
            {/* Header */}
            <header className={`fixed top-0 w-full z-50 border-b ${portalTheme.headerBg}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-white/10 p-2 shadow-inner border border-stone-200/20 flex items-center justify-center">
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
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 font-medium text-sm group ${portalTheme.logoutBtn}`}
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
                        <h2 className="text-4xl md:text-5xl font-['Playfair_Display'] font-black">
                            <span className={portalTheme.heroTitle}>Olá, </span>
                            <span className={portalTheme.heroName}>{displayName}</span>
                        </h2>
                        <p className={portalTheme.heroSubtitle}>
                            {isIncompleteProfile ? "Complete o seu cadastro para aproveitar todas as vantagens do portal." : "Bem-vindo ao seu espaço exclusivo de compras e fidelidade."}
                        </p>
                    </div>

                    <div className={`flex gap-4 p-1.5 rounded-2xl border backdrop-blur-md shadow-md ${portalTheme.statusCard}`}>
                        <div className={`px-4 py-2 rounded-xl border flex items-center gap-3 ${portalTheme.statusBadge}`}>
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold shrink-0">
                                <Crown size={20} />
                            </div>
                            <div>
                                <p className={portalTheme.statLabel}>Status</p>
                                <p className={portalTheme.statusMemberText}>{statusMembro}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Incomplete Profile Alert Banner */}
                {isIncompleteProfile && (
                    <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md shadow-md transition-all ${portalTheme.alertBanner}`}>
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 font-bold shadow-lg shadow-amber-500/20">
                                <AlertCircle size={22} />
                            </div>
                            <div>
                                <h4 className={portalTheme.alertTitle}>Seu cadastro está incompleto</h4>
                                <p className={portalTheme.alertText}>Cadastre seu nome completo e telefone para liberar resgates de coroas e histórico de compras.</p>
                            </div>
                        </div>
                        <button
                            onClick={openProfileEditor}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 ${portalTheme.alertButton}`}
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
                        <div className={`relative group overflow-hidden rounded-[2.5rem] p-8 text-white shadow-2xl transition-all duration-500 border ${portalTheme.loyaltyBg}`}>
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700 group-hover:rotate-12 pointer-events-none" aria-hidden="true">
                                <Crown size={180} />
                            </div>
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />

                            <div className="relative z-10 flex flex-col h-full justify-between gap-12">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                                            <Sparkles size={12} />
                                            Programa de Fidelidade
                                        </div>
                                        <h3 className="text-3xl font-['Playfair_Display'] font-bold text-white">Programa Coroas</h3>
                                    </div>
                                    <div className="w-16 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/50">
                                        <div className="w-8 h-6 border-[1.5px] border-white/40 rounded flex items-center justify-center">
                                            <div className="w-2 h-2 bg-white/30 rounded-full" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-amber-200/90 text-xs font-bold uppercase tracking-[.2em] mb-1">Saldo Atual</p>
                                            <div className="flex items-center gap-3">
                                                <span className="text-5xl font-black font-['Playfair_Display'] text-amber-400">{cliente?.coroas || 0}</span>
                                                <span className="text-amber-300/80 font-bold uppercase tracking-widest text-sm">Coroas</span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            {hasNextTier ? (
                                                <>
                                                    <p className="text-amber-200/90 text-xs font-bold uppercase tracking-[.2em] mb-1">Próximo Nível</p>
                                                    <p className="text-xs font-semibold text-stone-200">
                                                        {nextTier.nome} ({nextTier.coroas_minimas} coroas)
                                                    </p>
                                                </>
                                            ) : hasConfiguredReward ? (
                                                <>
                                                    <p className="text-amber-200/90 text-xs font-bold uppercase tracking-[.2em] mb-1">Próxima Recompensa</p>
                                                    <p className="text-xs font-semibold text-stone-200">
                                                        Resgate com {rewardThreshold} coroas
                                                    </p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-amber-200/90 text-xs font-bold uppercase tracking-[.2em] mb-1">Status Fidelidade</p>
                                                    <p className="text-xs font-semibold text-stone-200">
                                                        {currentTier?.nome ? `Nível ${currentTier.nome}` : "Pontuação Ativa"}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/20 p-[2px]">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-1000 relative group shadow-sm"
                                                style={{ width: `${progressPercent}%` }}
                                            >
                                                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.3)_50%,transparent_75%)] bg-[length:50px_50px] animate-[shimmer_2s_infinite]" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                                            <span>{progressLabelLeft}</span>
                                            {progressLabelCenter && (
                                                <span className="text-amber-300 font-extrabold">{progressLabelCenter}</span>
                                            )}
                                            <span>{progressLabelRight}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Redemption Card */}
                        {hasConfiguredReward && (cliente?.coroas || 0) >= rewardThreshold && (
                            <div className={`relative p-6 rounded-[2rem] border shadow-md ${portalTheme.card}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400"><Gift size={20} /></div>
                                    <div>
                                        <h3 className={`font-bold ${portalTheme.textHeading}`}>Resgatar Coroas</h3>
                                        <p className={`text-xs ${portalTheme.textMuted}`}>Converta Coroas em desconto na sua próxima compra</p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                                    <div className="flex-1">
                                        <label className={portalTheme.statLabel}>Quantidade de Coroas</label>
                                        <input type="number" min={fidelidadeConfig?.reward_threshold || 100} max={cliente?.coroas || 0}
                                            value={coroasParaResgatar} onChange={(e) => setCoroasParaResgatar(e.target.value)}
                                            placeholder={`Min: ${fidelidadeConfig?.reward_threshold || 100}`}
                                            className={`w-full px-3 py-2 rounded-xl text-sm ${portalTheme.input}`} />
                                    </div>
                                    {coroasParaResgatar && parseInt(coroasParaResgatar) > 0 && (
                                        <div className="text-right px-2">
                                            <p className={`text-xs ${portalTheme.textMuted}`}>Valor do Desconto</p>
                                            <p className="font-black text-emerald-600 dark:text-emerald-400 text-base">R$ {((parseInt(coroasParaResgatar) || 0) * (fidelidadeConfig?.desconto_por_coroa || 0.10)).toFixed(2)}</p>
                                        </div>
                                    )}
                                    <button onClick={handleResgatarDesconto} disabled={resgatando || !coroasParaResgatar}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 ${portalTheme.primaryButton}`}>
                                        {resgatando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        Gerar Cupom
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Coroas History */}
                        {historicoCoroas.length > 0 && (
                            <div className={`p-6 rounded-[2rem] border shadow-md ${portalTheme.card}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500"><Crown size={20} /></div>
                                    <h3 className={`font-bold ${portalTheme.textHeading}`}>Histórico de Coroas</h3>
                                </div>
                                <div className="divide-y divide-stone-200/30 dark:divide-amber-900/20">
                                    {historicoCoroas.map((h) => (
                                        <div key={h.id} className="flex items-center justify-between py-3">
                                            <div>
                                                <p className={`text-sm font-medium ${portalTheme.tableText}`}>{formatarTipoEvento(h.tipo_evento)}</p>
                                                <p className={`text-xs ${portalTheme.textMuted}`}>{new Date(h.created_at).toLocaleDateString("pt-BR")}</p>
                                            </div>
                                            <span className={`font-bold text-sm ${h.coroas > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
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
                                <div key={i} className={`group p-6 rounded-[2rem] border shadow-md transition-all duration-300 ${portalTheme.statCard}`}>
                                    <div className="flex items-center gap-4">
                                        <div className={portalTheme.statIcon}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div>
                                            <p className={portalTheme.statLabel}>{stat.label}</p>
                                            <p className={portalTheme.statValue}>{stat.value}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Rewards List */}
                        <div className={`p-8 rounded-[2.5rem] border shadow-xl ${portalTheme.card}`}>
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <Star className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className={`text-xl font-bold ${portalTheme.textHeading}`}>Níveis de Recompensa</h3>
                                    <p className={`text-xs ${portalTheme.textMuted}`}>Acumule coroas e desbloqueie benefícios exclusivos</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {milestones.map((milestone, index) => {
                                    const unlocked = currentSteps >= milestone.steps;
                                    return (
                                        <div
                                            key={index}
                                            className={`relative p-5 rounded-2xl flex items-center gap-5 transition-all duration-300 border ${
                                                unlocked ? portalTheme.rewardUnlocked : portalTheme.rewardLocked
                                            }`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${
                                                unlocked ? "bg-amber-500 text-stone-950 border-amber-400 shadow-md font-bold" : "bg-stone-200/50 dark:bg-stone-900 text-stone-500 border-stone-300 dark:border-stone-700"
                                            }`}>
                                                {unlocked ? <Crown size={16} /> : <span className="font-bold text-xs">{milestone.steps}</span>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm truncate ${unlocked ? (portalTheme.isDark ? "text-amber-100" : "text-stone-900") : portalTheme.textMuted}`}>{milestone.reward}</p>
                                                <p className={`text-[10px] uppercase tracking-widest font-bold mt-0.5 ${unlocked ? portalTheme.accentText : portalTheme.textMuted}`}>{milestone.steps} Coroas</p>
                                            </div>
                                            {unlocked && <Sparkles className="absolute top-4 right-4 w-4 h-4 text-amber-500/60 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Activity History */}
                        {isPedidosActive && (
                        <div className={`p-8 rounded-[2.5rem] border shadow-xl overflow-hidden ${portalTheme.card}`}>
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h3 className={`text-xl font-bold ${portalTheme.textHeading}`}>Histórico de Pedidos</h3>
                                        <p className={`text-xs ${portalTheme.textMuted}`}>Documentação das suas compras recentes</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className={`text-left border-b ${portalTheme.cardHeader}`}>
                                            <th className={`pb-4 px-4 ${portalTheme.tableHeader}`}>Pedido ID</th>
                                            <th className={`pb-4 px-4 ${portalTheme.tableHeader}`}>Data</th>
                                            <th className={`pb-4 px-4 ${portalTheme.tableHeader}`}>Valor</th>
                                            <th className={`pb-4 px-4 ${portalTheme.tableHeader}`}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-200/30 dark:divide-amber-900/20">
                                        {vendas.length > 0 ? vendas.map((p) => (
                                            <tr key={p.id} className={`group transition-colors ${portalTheme.tableRowHover}`}>
                                                <td className="py-5 px-4 font-mono text-sm text-amber-600 dark:text-amber-400 font-bold">#{String(p.id).slice(0, 8)}</td>
                                                <td className="py-5 px-4">
                                                    <div className={`flex items-center gap-2 font-medium ${portalTheme.tableText}`}>
                                                        <Calendar size={14} className={portalTheme.textMuted} />
                                                        {new Date(p.data_venda || p.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className={`py-5 px-4 font-bold ${portalTheme.tableHighlight}`}>{formatCurrency(p.valor_total)}</td>
                                                <td className="py-5 px-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                                        p.status === 'Concluído' || p.status === 'Concluída' 
                                                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                                                            : 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                                                    }`}>
                                                        {p.status || 'Pendente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className={`py-12 text-center text-sm italic ${portalTheme.textMuted}`}>Nenhum pedido encontrado.</td>
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
                        <div className={`p-8 rounded-[2.5rem] border shadow-xl relative overflow-hidden group ${portalTheme.card}`}>
                            <div className="absolute top-0 right-0 p-4 translate-x-4 -translate-y-4 opacity-5 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500 pointer-events-none">
                                <User size={120} />
                            </div>

                            <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                                <div className={`w-24 h-24 rounded-[2rem] p-2 relative ${portalTheme.profileAvatarBox}`}>
                                    <div className={`w-full h-full rounded-2xl flex items-center justify-center ${portalTheme.profileAvatarInner}`}>
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
                                    <h4 className={`text-2xl font-bold truncate ${portalTheme.textHeading}`}>
                                        {isNameValid ? cliente.nome_completo : 'Completar Perfil'}
                                    </h4>
                                    <p className={`text-xs font-medium truncate ${portalTheme.textMuted}`}>{user?.email}</p>

                                    {isIncompleteProfile && (
                                        <div className="inline-block mt-2">
                                            <button 
                                                onClick={openProfileEditor}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all"
                                            >
                                                <AlertCircle size={12} /> Cadastro Incompleto
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className={`p-4 rounded-2xl border ${portalTheme.profileFieldBox}`}>
                                    <p className={`mb-1 flex items-center gap-2 ${portalTheme.profileFieldLabel}`}>
                                        <Phone size={12} className={portalTheme.accentText} />
                                        Telefone
                                    </p>
                                    <p className={`text-sm font-bold ${portalTheme.tableText}`}>{cliente?.telefone || '-'}</p>
                                </div>
                                <div className={`p-4 rounded-2xl border ${portalTheme.profileFieldBox}`}>
                                    <p className={`mb-1 flex items-center gap-2 ${portalTheme.profileFieldLabel}`}>
                                        <MapPin size={12} className={portalTheme.accentText} />
                                        Localização
                                    </p>
                                    <p className={`text-sm font-bold truncate ${portalTheme.tableText}`}>{cliente?.cidade ? `${cliente.cidade} - ${cliente.estado}` : '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Support Card */}
                        {isAutoatendimentoActive && (
                        <div className={`p-8 rounded-[2.5rem] border shadow-xl flex flex-col items-center text-center space-y-4 ${portalTheme.card}`}>
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Phone size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className={`text-lg font-bold ${portalTheme.textHeading}`}>Precisa de Ajuda?</h4>
                                <p className={`text-xs ${portalTheme.textMuted}`}>Nossa equipe está disponível para te atender.</p>
                            </div>
                            <button
                                className={`font-bold text-sm hover:underline flex items-center gap-1 ${portalTheme.accentText}`}
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
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsEditing(false)} />
                    <div className={`relative w-full max-w-xl rounded-[2.5rem] shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${portalTheme.modalCard}`}>
                        <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/30">
                                        <Edit2 size={24} />
                                    </div>
                                    <div>
                                        <h3 className={`text-2xl font-bold ${portalTheme.textHeading}`}>Completar Perfil</h3>
                                        <p className={`text-xs ${portalTheme.textMuted}`}>Preencha seus dados para ter a melhor experiência</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(false)} className={`p-3 rounded-full transition-colors ${portalTheme.isDark ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600'}`}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label className={portalTheme.inputLabel}>Nome Completo *</Label>
                                    <Input
                                        type="text"
                                        value={editData.nome_completo}
                                        onChange={(e) => setEditData({ ...editData, nome_completo: e.target.value })}
                                        className={`w-full px-5 py-4 rounded-2xl font-medium h-auto ${portalTheme.input}`}
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>Telefone *</Label>
                                    <Input
                                        type="text"
                                        value={editData.telefone}
                                        onChange={(e) => setEditData({ ...editData, telefone: e.target.value })}
                                        className={`w-full px-5 py-4 rounded-2xl font-medium h-auto ${portalTheme.input}`}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>CEP</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            value={editData.cep}
                                            onChange={(e) => setEditData({ ...editData, cep: e.target.value })}
                                            className={`w-full px-5 py-4 rounded-2xl font-medium h-auto ${portalTheme.input}`}
                                            placeholder="00000-000"
                                        />
                                        <button onClick={() => buscarCEP(editData.cep)} className="p-4 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors">
                                            <Search size={20} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>Cidade</Label>
                                    <Input readOnly value={editData.cidade} className={`w-full px-5 py-4 rounded-2xl font-medium cursor-not-allowed h-auto ${portalTheme.inputReadOnly}`} />
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>UF</Label>
                                    <Input readOnly value={editData.estado} className={`w-full px-5 py-4 rounded-2xl font-medium cursor-not-allowed h-auto ${portalTheme.inputReadOnly}`} />
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className={portalTheme.inputLabel}>Endereço (Rua)</Label>
                                    <Input
                                        type="text"
                                        value={editData.endereco}
                                        onChange={(e) => setEditData({ ...editData, endereco: e.target.value })}
                                        className={`w-full px-5 py-4 rounded-2xl font-medium h-auto ${portalTheme.input}`}
                                        placeholder="Rua..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>Número</Label>
                                    <Input
                                        type="text"
                                        value={editData.numero}
                                        onChange={(e) => setEditData({ ...editData, numero: e.target.value })}
                                        className={`w-full px-5 py-4 rounded-2xl font-medium text-center h-auto ${portalTheme.input}`}
                                        placeholder="Nº"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={portalTheme.inputLabel}>Bairro</Label>
                                    <Input
                                        type="text"
                                        value={editData.bairro}
                                        onChange={(e) => setEditData({ ...editData, bairro: e.target.value })}
                                        className={`w-full px-5 py-4 rounded-2xl font-medium h-auto ${portalTheme.input}`}
                                        placeholder="Bairro"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={savingProfile}
                                className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${portalTheme.primaryButton}`}
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
