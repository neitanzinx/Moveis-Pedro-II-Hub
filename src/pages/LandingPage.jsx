import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Building2, ShieldCheck, TrendingUp, Truck, Wrench, Boxes, Users,
    BarChart3, ArrowRight, CheckCircle2, Lock, ChevronDown,
    Zap, Headphones, Smartphone, Check, Globe, DollarSign, Store, Crown,
    MessageCircle, Menu, X, LogIn, HelpCircle, FileText, Award
} from "lucide-react";

export default function LandingPage() {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    // Carregamento dinâmico dos planos do Supabase
    const [planos, setPlanos] = useState([]);
    const [loadingPlanos, setLoadingPlanos] = useState(true);

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
                setPlanos([]);
            } finally {
                setLoadingPlanos(false);
            }
        }
        loadPlanos();
    }, []);

    const scrollToSection = (id) => {
        setMobileMenuOpen(false);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 selection:text-[#07593f]">
            {/* Header / Navegação */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[#07593f] flex items-center justify-center text-white">
                                <Building2 className="w-5 h-5 stroke-[2.2]" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-none">
                                    Gest<span className="text-[#07593f]">App</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
                                    Gestão Comercial & Logística
                                </span>
                            </div>
                        </Link>

                        {/* Menu Desktop */}
                        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                            <button onClick={() => scrollToSection('pilares')} className="hover:text-[#07593f] transition-colors">
                                Funcionalidades
                            </button>
                            <button onClick={() => scrollToSection('portal-cliente')} className="hover:text-[#07593f] transition-colors">
                                Portal do Cliente
                            </button>
                            <button onClick={() => scrollToSection('planos')} className="hover:text-[#07593f] transition-colors">
                                Planos
                            </button>
                            <button onClick={() => scrollToSection('faq')} className="hover:text-[#07593f] transition-colors">
                                Dúvidas
                            </button>
                        </nav>

                        {/* Botões de Ação */}
                        <div className="hidden md:flex items-center gap-3">
                            <Link to="/login">
                                <Button variant="ghost" className="text-slate-700 hover:text-[#07593f] hover:bg-slate-100 font-semibold text-sm">
                                    <LogIn className="w-4 h-4 mr-2 text-[#07593f]" />
                                    Entrar
                                </Button>
                            </Link>

                            <Link to="/cadastro">
                                <Button className="bg-[#07593f] hover:bg-[#05432f] text-white font-bold text-sm px-5">
                                    Cadastrar Empresa
                                </Button>
                            </Link>
                        </div>

                        {/* Menu Mobile */}
                        <div className="md:hidden flex items-center gap-2">
                            <Link to="/login">
                                <Button size="sm" variant="outline" className="border-slate-300 text-[#07593f]">
                                    Entrar
                                </Button>
                            </Link>
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 text-slate-700 hover:text-slate-900 focus:outline-none"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-3">
                        <button
                            onClick={() => scrollToSection('pilares')}
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Funcionalidades
                        </button>
                        <button
                            onClick={() => scrollToSection('portal-cliente')}
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Portal do Cliente
                        </button>
                        <button
                            onClick={() => scrollToSection('planos')}
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Planos
                        </button>
                        <button
                            onClick={() => scrollToSection('faq')}
                            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Dúvidas Frequentes
                        </button>
                        <div className="pt-4 border-t border-slate-200 flex flex-col gap-2">
                            <Link to="/login" className="w-full">
                                <Button variant="outline" className="w-full justify-center border-slate-300 text-slate-700">
                                    <LogIn className="w-4 h-4 mr-2 text-[#07593f]" />
                                    Área da Empresa (Login)
                                </Button>
                            </Link>
                            <Link to="/cadastro" className="w-full">
                                <Button className="w-full justify-center bg-[#07593f] hover:bg-[#05432f] text-white font-bold">
                                    Cadastrar Minha Empresa
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            {/* SEÇÃO HERO */}
            <section className="pt-12 pb-16 md:pt-20 md:pb-24 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl space-y-6">
                        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-[1.2]">
                            Sistema de Gestão Comercial, Estoque e Logística para Lojas e Distribuidoras
                        </h1>

                        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                            Do balcão de vendas à entrega na casa do cliente: controle toda a sua operação em uma única plataforma web integrada e sem complicação.
                        </p>

                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Link to="/cadastro">
                                <Button size="lg" className="w-full sm:w-auto h-12 px-7 text-sm bg-[#07593f] hover:bg-[#05432f] text-white font-bold rounded-lg shadow-sm">
                                    Cadastrar Empresa
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>

                            <Link to="/login">
                                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-7 text-sm border-slate-300 text-slate-700 hover:bg-slate-50 font-medium rounded-lg">
                                    <LogIn className="w-4 h-4 mr-2 text-[#07593f]" />
                                    Acessar o Sistema
                                </Button>
                            </Link>
                        </div>

                        <div className="pt-4 flex flex-wrap gap-6 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-[#07593f]" />
                                Acesso 100% via navegador Web
                            </span>
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-[#07593f]" />
                                Suporte a múltiplas lojas e filiais
                            </span>
                            <span className="flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-[#07593f]" />
                                Backup diário automático
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO DOS 4 PILARES DA OPERAÇÃO */}
            <section id="pilares" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mb-12 space-y-2">
                        <h2 className="text-2xl sm:text-4xl font-bold text-slate-900">
                            Os 4 pilares do GestApp na sua empresa
                        </h2>
                        <p className="text-slate-600 text-base">
                            Tudo o que sua equipe precisa para operar com clareza e agilidade.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Pilar 1 */}
                        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#07593f] flex items-center justify-center">
                                    <Store className="w-5 h-5 stroke-[2.2]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">1. Vendas & PDV</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                                    Emissão rápida de orçamentos, venda no balcão, consulta imediata de estoque, e múltiplas formas de pagamento.
                                </p>
                            </div>
                        </div>

                        {/* Pilar 2 */}
                        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#07593f] flex items-center justify-center">
                                    <Boxes className="w-5 h-5 stroke-[2.2]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">2. Estoque Multi-Filial</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                                    Saldo unificado entre lojas e depósitos centralizados, inventário ágil e trava para impedir vendas sem saldo físico.
                                </p>
                            </div>
                        </div>

                        {/* Pilar 3 */}
                        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#07593f] flex items-center justify-center">
                                    <Truck className="w-5 h-5 stroke-[2.2]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">3. Logística & Montagem</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                                    Roteirização de frotas de entrega, link de rastreamento com mapa em tempo real e ordens de serviço para montadores.
                                </p>
                            </div>
                        </div>

                        {/* Pilar 4 */}
                        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#07593f] flex items-center justify-center">
                                    <Headphones className="w-5 h-5 stroke-[2.2]" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">4. Pós-Venda & Garantia</h3>
                                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                                    Autoatendimento para solicitações de assistência técnica via QR Code impresso diretamente na Nota Fiscal do produto.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO PORTAL DO CLIENTE COM A MARCA DA EMPRESA */}
            <section id="portal-cliente" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Texto e Benefícios */}
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#07593f] bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200">
                                <Crown className="w-4 h-4 text-[#07593f] fill-[#07593f]/20" />
                                <span>Portal do Cliente Exclusivo</span>
                            </div>

                            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 leading-tight">
                                Ofereça um Portal do Cliente personalizado com a marca da sua empresa
                            </h2>

                            <p className="text-slate-600 text-base leading-relaxed">
                                Além do gerenciamento interno, o GestApp fornece uma área exclusiva para os clientes da sua loja. Eles podem consultar compras, rastrear entregas ao vivo e acumular pontos de fidelidade.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                        <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                                        <span>Clube de Pontos</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">
                                        Fidelização com acúmulo de pontos/coroas a cada compra realizada.
                                    </p>
                                </div>

                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                        <Truck className="w-4 h-4 text-[#07593f]" />
                                        <span>Rastreio ao Vivo</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">
                                        Mapa GPS em tempo real enviando o status da entrega pelo celular.
                                    </p>
                                </div>

                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                        <Headphones className="w-4 h-4 text-[#07593f]" />
                                        <span>Assistência QR Code</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">
                                        Abertura de chamados de garantia escaneando a Nota Fiscal.
                                    </p>
                                </div>

                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                                        <FileText className="w-4 h-4 text-[#07593f]" />
                                        <span>Segunda Via de Notas</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed">
                                        Histórico completo de pedidos e documentos para o cliente.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Link to="/cadastro">
                                    <Button size="lg" className="h-12 px-7 bg-[#07593f] hover:bg-[#05432f] text-white font-bold rounded-lg text-sm shadow-sm">
                                        Testar no Cadastro de Empresa
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Card Ilustrativo Fiel ao ClienteDashboard */}
                        <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-md space-y-5">
                            {/* Header do App do Cliente */}
                            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[#07593f] text-white flex items-center justify-center text-xs font-bold">
                                        E
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Sua Empresa</h3>
                                        <p className="text-[10px] text-slate-500 font-medium">Portal do Cliente & Fidelidade</p>
                                    </div>
                                </div>
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-xs font-semibold flex items-center gap-1">
                                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    VIP Gold
                                </Badge>
                            </div>

                            {/* Card de Pontos do Cliente */}
                            <div className="bg-gradient-to-r from-[#07593f] to-emerald-800 p-5 rounded-xl text-white space-y-3 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-emerald-100 text-[11px] font-medium">Saldo de Pontos Acumulados</span>
                                        <p className="text-2xl font-bold font-mono mt-0.5">2.450 pts</p>
                                    </div>
                                    <Award className="w-7 h-7 text-amber-400" />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-emerald-100">
                                        <span>Meta para Resgate de Cupom</span>
                                        <span>75%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full w-[75%] bg-amber-400 rounded-full" />
                                    </div>
                                </div>
                            </div>

                            {/* Status da Entrega Recente */}
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <Truck className="w-4 h-4 text-[#07593f]" />
                                        Entrega do Pedido #8491
                                    </span>
                                    <Badge className="bg-emerald-100 text-[#07593f] text-[10px]">Em Trânsito</Badge>
                                </div>
                                <p className="text-slate-600 text-[11px]">
                                    Motorista a caminho • Chegada estimada às 14:30h
                                </p>
                                <div className="pt-1">
                                    <Button size="sm" variant="outline" className="w-full h-8 text-[11px] border-slate-300 text-slate-700 font-semibold bg-white hover:bg-slate-100">
                                        Ver localização no Mapa ao Vivo
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>


            {/* SEÇÃO DE PLANOS ATIVOS */}
            <section id="planos" className="py-16 md:py-24 bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-3xl mb-12 space-y-2">
                        <h2 className="text-2xl sm:text-4xl font-bold text-slate-900">
                            Planos transparentes para sua empresa
                        </h2>
                        <p className="text-slate-600 text-base">
                            Escolha o plano adequado para a estrutura do seu negócio.
                        </p>
                    </div>

                    {loadingPlanos ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#07593f] mx-auto mb-3" />
                            <p className="text-slate-500 text-xs">Carregando planos...</p>
                        </div>
                    ) : planos.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {planos.map((plano, index) => {
                                const isPopular = index === 1;
                                return (
                                    <div
                                        key={plano.id || index}
                                        className={`rounded-xl p-6 flex flex-col justify-between space-y-6 ${isPopular
                                            ? "bg-white border-2 border-[#07593f] shadow-md relative"
                                            : "bg-slate-50 border border-slate-200"
                                            }`}
                                    >
                                        {isPopular && (
                                            <div className="absolute -top-3 left-6 bg-[#07593f] text-white text-[10px] font-bold px-3 py-0.5 rounded uppercase tracking-wider">
                                                Recomendado
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900">{plano.nome}</h3>
                                                <p className="text-xs text-slate-600 mt-1">{plano.descricao || "Acesso completo à plataforma GestApp."}</p>
                                            </div>

                                            <div className="pt-2">
                                                <span className="text-3xl font-bold text-slate-900 font-mono">
                                                    {formatCurrency(plano.preco_mensal || 0)}
                                                </span>
                                                <span className="text-slate-500 text-xs"> / mês</span>
                                            </div>

                                            <div className="pt-3 space-y-2 text-xs text-slate-600 border-t border-slate-200">
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-[#07593f]" />
                                                    <span>Acesso via web em qualquer dispositivo</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-[#07593f]" />
                                                    <span>Suporte via WhatsApp</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Check className="w-4 h-4 text-[#07593f]" />
                                                    <span>Backups automáticos</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Link to={`/cadastro?plano=${plano.id}`} className="w-full">
                                            <Button
                                                className={`w-full font-bold text-sm h-11 ${isPopular
                                                    ? "bg-[#07593f] hover:bg-[#05432f] text-white"
                                                    : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
                                                    }`}
                                            >
                                                Selecionar Plano
                                            </Button>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* Fallback se a lista estiver em transição */
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { nome: "Starter", preco: 199, desc: "Para pequenos comércios e lojas em fase inicial." },
                                { nome: "Business", preco: 399, desc: "Para empresas com logística de entregas e montadores.", popular: true },
                                { nome: "Enterprise", preco: 799, desc: "Para redes de lojas e operações com múltiplas filiais." }
                            ].map((p, idx) => (
                                <div key={idx} className={`rounded-xl p-6 flex flex-col justify-between space-y-6 ${p.popular ? "bg-white border-2 border-[#07593f] shadow-md" : "bg-slate-50 border border-slate-200"}`}>
                                    <div className="space-y-3">
                                        <h3 className="text-xl font-bold text-slate-900">{p.nome}</h3>
                                        <p className="text-xs text-slate-600">{p.desc}</p>
                                        <div>
                                            <span className="text-3xl font-bold text-slate-900 font-mono">R$ {p.preco}</span>
                                            <span className="text-slate-500 text-xs"> / mês</span>
                                        </div>
                                    </div>
                                    <Link to="/cadastro" className="w-full">
                                        <Button className={`w-full font-bold text-sm h-11 ${p.popular ? "bg-[#07593f] hover:bg-[#05432f] text-white" : "bg-white border border-slate-300 text-slate-800"}`}>
                                            Cadastrar Empresa
                                        </Button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* SEÇÃO PERGUNTAS FREQUENTES (FAQ) */}
            <section id="faq" className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    <div className="space-y-2">
                        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Perguntas Frequentes</h2>
                        <p className="text-slate-600 text-sm">Respostas diretas para dúvidas comuns sobre o GestApp.</p>
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                q: "Como funciona a contratação do GestApp?",
                                a: "O cadastro é feito online. Você preenche os dados da sua empresa, seleciona o plano desejado e tem acesso imediato ao painel."
                            },
                            {
                                q: "O sistema exige instalação em servidores locais?",
                                a: "Não. O GestApp é 100% web e roda direto pelo navegador no computador, tablet ou celular."
                            },
                            {
                                q: "Como funciona o rastreamento de entregas para o cliente?",
                                a: "Ao agendar a entrega no módulo de logística, o sistema disponibiliza um link onde o cliente acompanha a localização do entregador no mapa."
                            },
                            {
                                q: "Como meus dados são mantidos em segurança?",
                                a: "Seus dados ficam 100% isolados por políticas de segurança a nível de linha (RLS), garantidos por backups diários automáticos."
                            }
                        ].map((item, idx) => (
                            <div
                                key={idx}
                                className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden cursor-pointer"
                                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                            >
                                <div className="p-4 flex justify-between items-center text-sm font-semibold text-slate-800">
                                    <span>{item.q}</span>
                                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${openFaq === idx ? "rotate-180 text-[#07593f]" : ""}`} />
                                </div>
                                {openFaq === idx && (
                                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-3 bg-white">
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CALL TO ACTION FINAL */}
            <section className="py-14 bg-[#07593f] text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
                    <h2 className="text-2xl sm:text-3xl font-bold">
                        Comece a organizar a gestão da sua empresa hoje
                    </h2>
                    <p className="text-emerald-100 text-sm max-w-lg mx-auto">
                        Cadastre sua empresa e unifique vendas, estoque, logística e atendimento.
                    </p>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Link to="/cadastro" className="w-full sm:w-auto">
                            <Button size="lg" className="w-full sm:w-auto h-12 px-7 text-sm bg-white hover:bg-slate-100 text-[#07593f] font-bold rounded-lg shadow-sm">
                                Cadastrar Empresa
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                        <Link to="/login" className="w-full sm:w-auto">
                            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-7 text-sm border-white/40 text-white hover:bg-white/10 rounded-lg font-semibold">
                                <LogIn className="w-4 h-4 mr-2" />
                                Acessar Minha Conta
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* RODAPÉ */}
            <footer className="bg-slate-900 text-slate-400 py-10 text-xs border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-[#07593f] flex items-center justify-center text-white">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <span className="text-lg font-bold text-white">GestApp</span>
                            </div>
                            <p className="text-slate-400 text-xs">
                                Plataforma de Gestão Comercial, Estoque e Logística.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-slate-200 text-xs uppercase">Links Rápidos</h4>
                            <ul className="space-y-1.5 text-xs">
                                <li><Link to="/login" className="hover:text-white transition-colors">Login da Empresa</Link></li>
                                <li><Link to="/cadastro" className="hover:text-white transition-colors">Cadastrar Empresa</Link></li>
                                <li><Link to="/cliente-login" className="hover:text-white transition-colors">Portal do Cliente</Link></li>
                                <li><Link to="/operador/login" className="hover:text-white transition-colors">Operador SaaS</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-slate-200 text-xs uppercase">Navegação</h4>
                            <ul className="space-y-1.5 text-xs">
                                <li><button onClick={() => scrollToSection('pilares')} className="hover:text-white transition-colors">Funcionalidades</button></li>
                                <li><button onClick={() => scrollToSection('portal-cliente')} className="hover:text-white transition-colors">Portal do Cliente</button></li>
                                <li><button onClick={() => scrollToSection('planos')} className="hover:text-white transition-colors">Planos</button></li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-semibold text-slate-200 text-xs uppercase">Suporte</h4>
                            <p className="text-slate-400 text-xs">
                                Atendimento aos clientes GestApp de Segunda a Sábado.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-500 text-[11px]">
                        <p>© 2026 GestApp. Todos os direitos reservados.</p>
                        <span>Sistemas Operacionais</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
