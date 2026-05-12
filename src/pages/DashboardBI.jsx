import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    ShoppingCart,
    Users,
    Package,
    Truck,
    Target,
    Calendar,
    BarChart3,
    PieChart,
    RefreshCw,
    AlertTriangle,
    Award,
    Store,
    Star,
    Heart,
    Repeat,
    Box,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowUpRight,
    ArrowDownRight,
    Layers,
    Hammer,
    Smile,
    Frown,
    Meh
} from "lucide-react";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart as RechartsPie,
    Pie,
    Cell,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    filtrarPorPeriodo,
    formatarMoeda,
    formatarPct,
    calcularKPIsVendas,
    calcularTaxaConversao,
    agruparPorCanal,
    calcularKPIsEstoque,
    calcularKPIsLogistica,
    calcularKPIsClientes,
    calcularRankings,
    agruparVendasPorDia,
    agruparPorFormaPagamento
} from "@/utils/biCalculations";
import { isVendaCancelada } from "@/utils/vendaStatus";

// ── Paleta de Cores ──────────────────────────────────────────────
const CORES = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const CORES_STATUS = {
    'Entregue': '#10b981',
    'agendado': '#3b82f6',
    'Em Rota': '#f59e0b',
    'Cancelada': '#ef4444',
    'Reagendado': '#8b5cf6',
};

// ── Componente KPI Card ──────────────────────────────────────────
function KPICard({ titulo, valor, icone: Icon, cor = 'green', subtitulo, trend, small, tooltip }) {
    const corMap = {
        green: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
        blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20',
        yellow: 'from-amber-500/10 to-amber-600/5 border-amber-500/20',
        red: 'from-red-500/10 to-red-600/5 border-red-500/20',
        purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20',
        cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
    };
    const iconCorMap = {
        green: 'text-emerald-500',
        blue: 'text-blue-500',
        yellow: 'text-amber-500',
        red: 'text-red-500',
        purple: 'text-purple-500',
        cyan: 'text-cyan-500',
    };

    const CardContentRender = (
        <Card className={`bg-gradient-to-br ${corMap[cor]} border h-full transition-all hover:shadow-md cursor-default`}>
            <CardContent className={small ? "p-3" : "p-4"}>
                <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-xs font-medium text-muted-foreground truncate">{titulo}</p>
                            {tooltip && <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />}
                        </div>
                        <p className={`${small ? 'text-lg' : 'text-xl'} font-bold mt-0.5 truncate`}>{valor}</p>
                        {/* {subtitulo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitulo}</p>} */}
                        {/* Removido o subtítulo daqui para não poluir, se já tem tooltip explicar melhor lá ou manter se for crítico */}
                        {subtitulo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitulo}</p>}
                    </div>
                    <div className={`p-2 rounded-lg bg-background/50 ${iconCorMap[cor]}`}>
                        <Icon className={small ? "w-4 h-4" : "w-5 h-5"} />
                    </div>
                </div>
                {trend !== undefined && trend !== null && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );

    if (tooltip) {
        return (
            <TooltipProvider>
                <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                        <div className="h-full">{CardContentRender}</div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs bg-slate-900 border-slate-800 text-slate-100">
                        <p>{tooltip}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return <div className="h-full">{CardContentRender}</div>;
}

// ── Componente: Sem Dados ────────────────────────────────────────
function SemDados({ mensagem = "Dados insuficientes para exibição" }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">{mensagem}</p>
        </div>
    );
}

// ── Tooltip customizado ──────────────────────────────────────────
function CustomTooltip({ active, payload, label, valuePrefix = '' }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
            <p className="font-medium mb-1">{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color }} className="text-xs">
                    {p.name}: {valuePrefix}{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
                </p>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD BI - COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default function DashboardBI() {
    const [periodo, setPeriodo] = useState('mes');
    const [lojaFiltro, setLojaFiltro] = useState('todas');
    const [abaAtiva, setAbaAtiva] = useState('geral');

    // ── Data Fetching ─────────────────────────────────────────────
    const { data: vendas = [], isLoading: loadingVendas, refetch: refetchVendas } = useQuery({
        queryKey: ['bi-vendas'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: users = [] } = useQuery({
        queryKey: ['bi-users'],
        queryFn: () => base44.entities.User.list()
    });

    const { data: lancamentos = [] } = useQuery({
        queryKey: ['bi-lancamentos'],
        queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_lancamento')
    });

    const { data: entregas = [] } = useQuery({
        queryKey: ['bi-entregas'],
        queryFn: () => base44.entities.Entrega.list('-data_agendada')
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['bi-produtos'],
        queryFn: () => base44.entities.Produto.list()
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['bi-clientes'],
        queryFn: () => base44.entities.Cliente.list()
    });

    const { data: orcamentos = [] } = useQuery({
        queryKey: ['bi-orcamentos'],
        queryFn: () => base44.entities.Orcamento.list()
    });

    const { data: npsAvaliacoes = [] } = useQuery({
        queryKey: ['bi-nps'],
        queryFn: () => base44.entities.NPSAvaliacao.list('-created_at')
    });

    const { data: montagens = [] } = useQuery({
        queryKey: ['bi-montagens'],
        queryFn: () => base44.entities.MontagemItem.list()
    });

    // ── Filter function ───────────────────────────────────────────
    const filtroFn = useCallback(
        (data) => filtrarPorPeriodo(data, periodo),
        [periodo]
    );

    // ── Filtered sets ─────────────────────────────────────────────
    const vendasFiltradas = useMemo(() =>
        vendas.filter(v => {
            const matchPeriodo = filtroFn(v.data_venda);
            const matchLoja = lojaFiltro === 'todas' || v.loja === lojaFiltro;
            return matchPeriodo && matchLoja && !isVendaCancelada(v);
        }),
        [vendas, periodo, lojaFiltro, filtroFn]
    );

    const entregasFiltradas = useMemo(() =>
        entregas.filter(e => filtroFn(e.data_agendada) && (lojaFiltro === 'todas' || true)),
        [entregas, filtroFn, lojaFiltro]
    );

    const orcamentosFiltrados = useMemo(() =>
        orcamentos.filter(o => filtroFn(o.created_at || o.data_orcamento)),
        [orcamentos, filtroFn]
    );

    // ── Computed KPIs ─────────────────────────────────────────────
    const kpisVendas = useMemo(() => calcularKPIsVendas(vendasFiltradas, lancamentos, filtroFn), [vendasFiltradas, lancamentos, filtroFn]);
    const kpisEstoque = useMemo(() => calcularKPIsEstoque(produtos, vendasFiltradas), [produtos, vendasFiltradas]);
    const kpisLogistica = useMemo(() => calcularKPIsLogistica(entregasFiltradas, vendasFiltradas), [entregasFiltradas, vendasFiltradas]);
    const kpisClientes = useMemo(() => calcularKPIsClientes(clientes, vendasFiltradas, npsAvaliacoes, filtroFn), [clientes, vendasFiltradas, npsAvaliacoes, filtroFn]);
    const rankings = useMemo(() => calcularRankings(vendasFiltradas, users), [vendasFiltradas, users]);
    const taxaConversao = useMemo(() => calcularTaxaConversao(orcamentosFiltrados, vendasFiltradas), [orcamentosFiltrados, vendasFiltradas]);
    const vendasPorCanal = useMemo(() => agruparPorCanal(vendasFiltradas), [vendasFiltradas]);
    const dadosVendasDia = useMemo(() => agruparVendasPorDia(vendasFiltradas), [vendasFiltradas]);
    const dadosFormaPgto = useMemo(() => agruparPorFormaPagamento(vendasFiltradas, lancamentos), [vendasFiltradas, lancamentos]);

    // ── Store list for filter ─────────────────────────────────────
    const lojas = useMemo(() => {
        const set = new Set(vendas.map(v => v.loja).filter(Boolean));
        return [...set].sort();
    }, [vendas]);

    // ── Loading State ─────────────────────────────────────────────
    if (loadingVendas) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-sm text-muted-foreground">Carregando dados do BI...</p>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-emerald-500" />
                        Dashboard BI
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Inteligência de negócios • Móveis Pedro II
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={periodo} onValueChange={setPeriodo}>
                        <SelectTrigger className="w-[130px]">
                            <Calendar className="w-4 h-4 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hoje">Hoje</SelectItem>
                            <SelectItem value="semana">Semana</SelectItem>
                            <SelectItem value="mes">Mês</SelectItem>
                            <SelectItem value="ano">Ano</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                        <SelectTrigger className="w-[160px]">
                            <Store className="w-4 h-4 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas as Lojas</SelectItem>
                            {lojas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={() => refetchVendas()} title="Atualizar">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
                <TabsList className="grid w-full grid-cols-5 h-auto">
                    <TabsTrigger value="geral" className="text-xs sm:text-sm py-2">
                        <PieChart className="w-4 h-4 mr-1 hidden sm:block" /> Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="vendas" className="text-xs sm:text-sm py-2">
                        <ShoppingCart className="w-4 h-4 mr-1 hidden sm:block" /> Vendas
                    </TabsTrigger>
                    <TabsTrigger value="estoque" className="text-xs sm:text-sm py-2">
                        <Package className="w-4 h-4 mr-1 hidden sm:block" /> Estoque
                    </TabsTrigger>
                    <TabsTrigger value="logistica" className="text-xs sm:text-sm py-2">
                        <Truck className="w-4 h-4 mr-1 hidden sm:block" /> Logística
                    </TabsTrigger>
                    <TabsTrigger value="clientes" className="text-xs sm:text-sm py-2">
                        <Users className="w-4 h-4 mr-1 hidden sm:block" /> Clientes
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════════════════════════════════════════
                    TAB 1 — VISÃO GERAL
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="geral" className="space-y-6 mt-4">
                    {/* KPI Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <KPICard
                            titulo="Faturamento"
                            valor={formatarMoeda(kpisVendas.faturamento)}
                            icone={DollarSign}
                            cor="green"
                            subtitulo={`${kpisVendas.qtdVendas} vendas`}
                            tooltip="Soma do valor total de todas as vendas realizadas no período selecionado."
                        />
                        <KPICard
                            titulo="Ticket Médio"
                            valor={formatarMoeda(kpisVendas.ticketMedio)}
                            icone={Target}
                            cor="blue"
                            tooltip="Valor médio gasto por venda. Cálculo: Faturamento Total ÷ Quantidade de Vendas."
                        />
                        <KPICard
                            titulo="Lucro / Prejuízo"
                            valor={formatarMoeda(kpisVendas.lucro)}
                            icone={kpisVendas.lucro >= 0 ? TrendingUp : TrendingDown}
                            cor={kpisVendas.lucro >= 0 ? 'green' : 'red'}
                            subtitulo={`R: ${formatarMoeda(kpisVendas.receitas)} | D: ${formatarMoeda(kpisVendas.despesas)}`}
                            tooltip="Resultado financeiro líquido. Cálculo: Total de Receitas (Lançamentos) - Total de Despesas (Lançamentos)."
                        />
                        <KPICard
                            titulo="Novos Clientes"
                            valor={kpisClientes.novosClientes}
                            icone={Users}
                            cor="purple"
                            subtitulo={`Total: ${kpisClientes.totalClientes}`}
                            tooltip="Número de clientes cadastrados pela primeira vez no sistema durante este período."
                        />
                        <KPICard
                            titulo="Valor Estoque"
                            valor={formatarMoeda(kpisEstoque.valorEstoque)}
                            icone={Package}
                            cor="cyan"
                            tooltip="Valor total do estoque atual calculado pelo preço de custo (Quantidade * Preço de Custo)."
                        />
                        <KPICard
                            titulo="Entregas Pendentes"
                            valor={kpisLogistica.entregasPendentes}
                            icone={Truck}
                            cor={kpisLogistica.entregasPendentes > 5 ? 'yellow' : 'green'}
                            subtitulo={`${kpisLogistica.entregasConcluidas} concluídas`}
                            tooltip="Número de entregas agendadas que ainda não foram marcadas como 'Entregue' ou 'Cancelada'."
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Vendas por Dia */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                                    Vendas por Dia
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dadosVendasDia.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={dadosVendasDia}>
                                            <defs>
                                                <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="diaFormatado" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                            <RechartsTooltip content={<CustomTooltip valuePrefix="R$ " />} />
                                            <Area type="monotone" dataKey="total" stroke="#10b981" fill="url(#gradVendas)" name="Faturamento" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : <SemDados mensagem="Sem vendas no período selecionado" />}
                            </CardContent>
                        </Card>

                        {/* Formas de Pagamento */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <PieChart className="w-5 h-5 text-blue-500" />
                                    Formas de Pagamento
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dadosFormaPgto.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <RechartsPie>
                                            <Pie
                                                data={dadosFormaPgto}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={3}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {dadosFormaPgto.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                                            </Pie>
                                            <RechartsTooltip formatter={(v) => formatarMoeda(v)} />
                                        </RechartsPie>
                                    </ResponsiveContainer>
                                ) : <SemDados mensagem="Sem dados de pagamento no período" />}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    TAB 2 — VENDAS & COMERCIAL
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="vendas" className="space-y-6 mt-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <KPICard
                            titulo="Faturamento"
                            valor={formatarMoeda(kpisVendas.faturamento)}
                            icone={DollarSign}
                            cor="green"
                            subtitulo={`${kpisVendas.qtdVendas} vendas`}
                            tooltip="Soma total das vendas confirmadas no período."
                        />
                        <KPICard
                            titulo="Ticket Médio"
                            valor={formatarMoeda(kpisVendas.ticketMedio)}
                            icone={Target}
                            cor="blue"
                            tooltip="Valor médio por venda (Faturamento / Quantidade Vendas)."
                        />
                        <KPICard
                            titulo="Taxa Conversão"
                            valor={formatarPct(taxaConversao)}
                            icone={Repeat}
                            cor="purple"
                            subtitulo={`${orcamentosFiltrados.length} orçamentos → ${vendasFiltradas.length} vendas`}
                            tooltip="Percentual de orçamentos que viraram venda (Vendas / Orçamentos * 100)."
                        />
                        <KPICard
                            titulo="Margem Bruta"
                            valor={formatarMoeda(kpisEstoque.margemBruta)}
                            icone={TrendingUp}
                            cor={kpisEstoque.margemBruta >= 0 ? 'green' : 'red'}
                            tooltip="Diferença entre o preço de venda e o preço de custo dos produtos vendidos (Receita - CMV)."
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Ranking Vendedores */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500" />
                                    Top Vendedores
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {rankings.topVendedores.length > 0 ? (
                                    <div className="space-y-3">
                                        {rankings.topVendedores.map((v, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{v.nome}</p>
                                                    <p className="text-xs text-muted-foreground">{v.qtd} vendas</p>
                                                </div>
                                                <span className="text-sm font-semibold text-emerald-500">{formatarMoeda(v.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <SemDados mensagem="Sem dados de vendedores" />}
                            </CardContent>
                        </Card>

                        {/* Vendas por Canal */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-purple-500" />
                                    Vendas por Canal
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {vendasPorCanal.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={vendasPorCanal} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                            <YAxis dataKey="canal" type="category" tick={{ fontSize: 11 }} width={100} stroke="hsl(var(--muted-foreground))" />
                                            <RechartsTooltip content={<CustomTooltip valuePrefix="R$ " />} />
                                            <Bar dataKey="total" fill="#8b5cf6" name="Receita" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <SemDados mensagem="Sem dados de canais" />}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Produtos */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-blue-500" />
                                Top Produtos Vendidos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {rankings.topProdutos.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10">#</TableHead>
                                                <TableHead>Produto</TableHead>
                                                <TableHead className="text-right">Qtd</TableHead>
                                                <TableHead className="text-right">Receita</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rankings.topProdutos.map((p, i) => (
                                                <TableRow key={i}>
                                                    <TableCell>
                                                        <Badge variant={i < 3 ? "default" : "secondary"} className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                                                            {i + 1}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium max-w-[200px] truncate">{p.nome}</TableCell>
                                                    <TableCell className="text-right">{p.qtd}</TableCell>
                                                    <TableCell className="text-right font-semibold text-emerald-500">{formatarMoeda(p.total)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : <SemDados mensagem="Sem dados de produtos vendidos" />}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    TAB 3 — ESTOQUE & PRODUTO
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="estoque" className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <KPICard
                            titulo="Valor Estoque"
                            valor={formatarMoeda(kpisEstoque.valorEstoque)}
                            icone={Package}
                            cor="blue"
                            tooltip="Valor total atual do estoque com base no preço de custo."
                        />
                        <KPICard
                            titulo="Giro de Estoque"
                            valor={kpisEstoque.giroEstoque.toFixed(2) + 'x'}
                            icone={Repeat}
                            cor="green"
                            subtitulo="Custo vendidos / estoque"
                            tooltip="Quantas vezes o estoque foi renovado no período. (Custo das Vendas / Valor Médio Estoque)."
                        />
                        <KPICard
                            titulo="GMROI"
                            valor={kpisEstoque.gmroi.toFixed(2)}
                            icone={TrendingUp}
                            cor={kpisEstoque.gmroi >= 1 ? 'green' : 'red'}
                            subtitulo="Margem / custo estoque"
                            tooltip="Retorno sobre investimento em estoque. Para cada R$ 1,00 investido, quanto retornou de margem bruta."
                        />
                        <KPICard
                            titulo="Idade Média"
                            valor={`${kpisEstoque.idadeMediaEstoque} dias`}
                            icone={Clock}
                            cor="yellow"
                            tooltip="Tempo médio que os produtos estão parados no estoque desde a data de cadastro/chegada."
                        />
                        <KPICard
                            titulo="Abaixo do Mínimo"
                            valor={kpisEstoque.produtosAbaixoMinimo.length}
                            icone={AlertTriangle}
                            cor={kpisEstoque.produtosAbaixoMinimo.length > 10 ? 'red' : 'yellow'}
                            tooltip="Número de produtos com quantidade atual inferior ao 'Estoque Mínimo' definido."
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Estoque por Categoria */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-blue-500" />
                                    Valor em Estoque por Categoria
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpisEstoque.porCategoria.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={kpisEstoque.porCategoria} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                                            <YAxis dataKey="categoria" type="category" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
                                            <RechartsTooltip content={<CustomTooltip valuePrefix="R$ " />} />
                                            <Bar dataKey="valor" fill="#3b82f6" name="Valor" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <SemDados />}
                            </CardContent>
                        </Card>

                        {/* Alertas Estoque Baixo */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    Alertas de Estoque Baixo
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpisEstoque.produtosAbaixoMinimo.length > 0 ? (
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {kpisEstoque.produtosAbaixoMinimo.slice(0, 15).map((p, i) => (
                                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{p.nome}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Estoque: <span className="text-red-500 font-medium">{p.quantidade_estoque || 0}</span> / Mínimo: {p.estoque_minimo}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {kpisEstoque.produtosAbaixoMinimo.length > 15 && (
                                            <p className="text-xs text-muted-foreground text-center pt-2">
                                                +{kpisEstoque.produtosAbaixoMinimo.length - 15} produtos...
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-emerald-500">
                                        <CheckCircle2 className="w-8 h-8 mb-2" />
                                        <p className="text-sm">Todos os produtos acima do mínimo!</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    TAB 4 — LOGÍSTICA
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="logistica" className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <KPICard
                            titulo="Total Entregas"
                            valor={kpisLogistica.totalEntregas}
                            icone={Truck}
                            cor="blue"
                            tooltip="Número total de entregas agendadas no período."
                        />
                        <KPICard
                            titulo="Concluídas"
                            valor={kpisLogistica.entregasConcluidas}
                            icone={CheckCircle2}
                            cor="green"
                            tooltip="Número de entregas com status 'Entregue' no período."
                        />
                        <KPICard
                            titulo="Pendentes"
                            valor={kpisLogistica.entregasPendentes}
                            icone={Clock}
                            cor="yellow"
                            tooltip="Entregas que ainda não foram concluídas nem canceladas."
                        />
                        <KPICard
                            titulo="Lead Time Médio"
                            valor={kpisLogistica.leadTimeMedio !== 'N/A' ? `${kpisLogistica.leadTimeMedio} dias` : 'N/A'}
                            icone={Calendar}
                            cor="blue"
                            subtitulo="Venda → Entrega"
                            tooltip="Média de dias decorridos entre a data da venda e a data da entrega realizada."
                        />
                        <KPICard
                            titulo="Pontualidade"
                            valor={formatarPct(kpisLogistica.taxaPontualidade)}
                            icone={Target}
                            cor={kpisLogistica.taxaPontualidade >= 80 ? 'green' : kpisLogistica.taxaPontualidade >= 60 ? 'yellow' : 'red'}
                            tooltip="Percentual de entregas realizadas na data agendada ou antes."
                        />
                        <KPICard
                            titulo="Avarias"
                            valor={formatarPct(kpisLogistica.indiceAvarias)}
                            icone={AlertTriangle}
                            cor={kpisLogistica.indiceAvarias <= 2 ? 'green' : 'red'}
                            subtitulo={`Frete: ${formatarPct(kpisLogistica.freteSobreReceita)} da receita`}
                            tooltip="Percentual de entregas que registraram alguma avaria (Dano / Total Entregas)."
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Entregas por Status */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <PieChart className="w-5 h-5 text-blue-500" />
                                    Entregas por Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpisLogistica.porStatus.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <RechartsPie>
                                            <Pie
                                                data={kpisLogistica.porStatus}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={55}
                                                outerRadius={95}
                                                paddingAngle={3}
                                                label={({ name, value }) => `${name} (${value})`}
                                            >
                                                {kpisLogistica.porStatus.map((entry, i) => (
                                                    <Cell key={i} fill={CORES_STATUS[entry.name] || CORES[i % CORES.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                        </RechartsPie>
                                    </ResponsiveContainer>
                                ) : <SemDados mensagem="Sem entregas no período" />}
                            </CardContent>
                        </Card>

                        {/* Montagens */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Hammer className="w-5 h-5 text-purple-500" />
                                    Montagens
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const montagensFiltradas = montagens.filter(m => filtroFn(m.data_agendada || m.created_at));
                                    const pendentes = montagensFiltradas.filter(m => m.status === 'pendente').length;
                                    const agendadas = montagensFiltradas.filter(m => m.status === 'agendado' || m.status === 'agendada').length;
                                    const concluidas = montagensFiltradas.filter(m => m.status === 'concluida' || m.status === 'concluído').length;
                                    const total = montagensFiltradas.length;

                                    if (total === 0) return <SemDados mensagem="Sem montagens no período" />;

                                    return (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-3">
                                                <KPICard small titulo="Pendentes" valor={pendentes} icone={Clock} cor="yellow" />
                                                <KPICard small titulo="Agendadas" valor={agendadas} icone={Calendar} cor="blue" />
                                                <KPICard small titulo="Concluídas" valor={concluidas} icone={CheckCircle2} cor="green" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                    <span>Progresso</span>
                                                    <span>{total > 0 ? ((concluidas / total) * 100).toFixed(0) : 0}%</span>
                                                </div>
                                                <Progress value={total > 0 ? (concluidas / total) * 100 : 0} className="h-2" />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════════
                    TAB 5 — CLIENTES & NPS
                ═══════════════════════════════════════════════════ */}
                <TabsContent value="clientes" className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <KPICard
                            titulo="Total Clientes"
                            valor={kpisClientes.totalClientes}
                            icone={Users}
                            cor="blue"
                            subtitulo={`+${kpisClientes.novosClientes} no período`}
                            tooltip="Número total de clientes cadastrados na base."
                        />
                        <KPICard
                            titulo="LTV Médio"
                            valor={formatarMoeda(kpisClientes.ltvMedio)}
                            icone={DollarSign}
                            cor="green"
                            subtitulo="Receita / cliente"
                            tooltip="Lifetime Value (Valor do Tempo de Vida): Média de quanto cada cliente gastou durante todo o período."
                        />
                        <KPICard
                            titulo="Taxa Recompra"
                            valor={formatarPct(kpisClientes.taxaRecompra)}
                            icone={Repeat}
                            cor="purple"
                            tooltip="Porcentagem de clientes que fizeram mais de uma compra."
                        />
                        <KPICard
                            titulo="NPS Score"
                            valor={kpisClientes.npsScore !== null ? kpisClientes.npsScore : 'N/A'}
                            icone={kpisClientes.npsScore === null ? Meh : kpisClientes.npsScore >= 50 ? Smile : kpisClientes.npsScore >= 0 ? Meh : Frown}
                            cor={kpisClientes.npsScore === null ? 'blue' : kpisClientes.npsScore >= 50 ? 'green' : kpisClientes.npsScore >= 0 ? 'yellow' : 'red'}
                            subtitulo={kpisClientes.totalNps > 0 ? `${kpisClientes.totalNps} avaliações` : 'Sem avaliações'}
                            tooltip="Net Promoter Score: (Promotores - Detratores) / Total * 100."
                        />
                        <KPICard
                            titulo="Promotores"
                            valor={kpisClientes.promotores}
                            icone={Heart}
                            cor="green"
                            subtitulo={`Detratores: ${kpisClientes.detratores}`}
                            tooltip="Número de clientes que avaliaram com nota 9 ou 10 (Recomendariam)."
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* NPS Satisfaction Scores */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Star className="w-5 h-5 text-amber-500" />
                                    Satisfação (Médias NPS)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpisClientes.totalNps > 0 ? (
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={[
                                            { name: 'Atendimento', nota: Number(kpisClientes.mediaAtendimento.toFixed(1)) },
                                            { name: 'Entrega', nota: Number(kpisClientes.mediaEntrega.toFixed(1)) },
                                            { name: 'Qualidade', nota: Number(kpisClientes.mediaQualidade.toFixed(1)) },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                                            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                            <RechartsTooltip />
                                            <Bar dataKey="nota" name="Nota Média" radius={[4, 4, 0, 0]}>
                                                {[0, 1, 2].map(i => (
                                                    <Cell key={i} fill={['#10b981', '#3b82f6', '#8b5cf6'][i]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <SemDados mensagem="Sem avaliações NPS registradas" />}
                            </CardContent>
                        </Card>

                        {/* Top Clientes */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Award className="w-5 h-5 text-emerald-500" />
                                    Top Clientes por Receita
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpisClientes.topClientes.length > 0 ? (
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                        {kpisClientes.topClientes.map((c, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{c.nome}</p>
                                                    <p className="text-xs text-muted-foreground">{c.compras} compras</p>
                                                </div>
                                                <span className="text-sm font-semibold text-emerald-500">{formatarMoeda(c.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <SemDados mensagem="Sem dados de clientes" />}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
