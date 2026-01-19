import React, { useState, useMemo } from "react";
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
    Store
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
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// Cores para gráficos
const CORES = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardBI() {
    const [periodo, setPeriodo] = useState('mes'); // hoje, semana, mes, ano
    const [lojaFiltro, setLojaFiltro] = useState('todas');

    // Buscar dados
    const { data: vendas = [], refetch: refetchVendas, isLoading: loadingVendas } = useQuery({
        queryKey: ['vendas-bi'],
        queryFn: () => base44.entities.Venda.list('-data_venda')
    });

    const { data: lancamentos = [] } = useQuery({
        queryKey: ['lancamentos-bi'],
        queryFn: () => base44.entities.LancamentoFinanceiro.list('-data_lancamento')
    });

    const { data: entregas = [] } = useQuery({
        queryKey: ['entregas-bi'],
        queryFn: () => base44.entities.Entrega.list('-data_agendada')
    });

    const { data: produtos = [] } = useQuery({
        queryKey: ['produtos-bi'],
        queryFn: () => base44.entities.Produto.list()
    });

    const { data: clientes = [] } = useQuery({
        queryKey: ['clientes-bi'],
        queryFn: () => base44.entities.Cliente.list()
    });

    // Filtrar por período
    const filtrarPorPeriodo = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return (data) => {
            if (!data) return false;
            const d = new Date(data);
            d.setHours(0, 0, 0, 0);

            switch (periodo) {
                case 'hoje':
                    return d.getTime() === hoje.getTime();
                case 'semana':
                    const inicioSemana = new Date(hoje);
                    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                    return d >= inicioSemana;
                case 'mes':
                    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
                case 'ano':
                    return d.getFullYear() === hoje.getFullYear();
                default:
                    return true;
            }
        };
    }, [periodo]);

    // Vendas filtradas
    const vendasFiltradas = useMemo(() => {
        return vendas.filter(v => {
            const matchPeriodo = filtrarPorPeriodo(v.data_venda);
            const matchLoja = lojaFiltro === 'todas' || v.loja === lojaFiltro;
            return matchPeriodo && matchLoja && v.status !== 'Cancelada';
        });
    }, [vendas, periodo, lojaFiltro, filtrarPorPeriodo]);

    // Calcular KPIs
    const kpis = useMemo(() => {
        const totalFaturamento = vendasFiltradas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
        const qtdVendas = vendasFiltradas.length;
        const ticketMedio = qtdVendas > 0 ? totalFaturamento / qtdVendas : 0;

        // Receitas e despesas
        const receitas = lancamentos.filter(l =>
            l.tipo === 'receita' && filtrarPorPeriodo(l.data_lancamento) && l.status !== 'Cancelado'
        ).reduce((sum, l) => sum + (l.valor || 0), 0);

        const despesas = lancamentos.filter(l =>
            l.tipo === 'despesa' && filtrarPorPeriodo(l.data_lancamento) && l.status !== 'Cancelado'
        ).reduce((sum, l) => sum + Math.abs(l.valor || 0), 0);

        // Entregas
        const entregasPeriodo = entregas.filter(e => filtrarPorPeriodo(e.data_agendada));
        const entreguesHoje = entregasPeriodo.filter(e => e.status === 'Entregue').length;
        const pendentes = entregasPeriodo.filter(e => !['Entregue', 'Cancelada'].includes(e.status)).length;

        // Estoque
        const valorEstoque = produtos.reduce((sum, p) =>
            sum + ((p.quantidade_estoque || 0) * (p.preco_custo || 0)), 0
        );
        const produtosAbaixoMinimo = produtos.filter(p =>
            p.estoque_minimo && p.quantidade_estoque < p.estoque_minimo
        ).length;

        // Novos clientes
        const novosClientes = clientes.filter(c =>
            filtrarPorPeriodo(c.created_at)
        ).length;

        return {
            faturamento: totalFaturamento,
            qtdVendas,
            ticketMedio,
            receitas,
            despesas,
            lucro: receitas - despesas,
            entregasRealizadas: entreguesHoje,
            entregasPendentes: pendentes,
            valorEstoque,
            produtosAbaixoMinimo,
            novosClientes,
            totalClientes: clientes.length
        };
    }, [vendasFiltradas, lancamentos, entregas, produtos, clientes, filtrarPorPeriodo]);

    // Dados para gráficos
    const dadosVendasPorDia = useMemo(() => {
        const agrupado = {};
        vendasFiltradas.forEach(v => {
            const dia = v.data_venda?.split('T')[0];
            if (!dia) return;
            if (!agrupado[dia]) agrupado[dia] = { dia, total: 0, qtd: 0 };
            agrupado[dia].total += v.valor_total || 0;
            agrupado[dia].qtd++;
        });
        return Object.values(agrupado)
            .sort((a, b) => a.dia.localeCompare(b.dia))
            .map(d => ({
                ...d,
                diaFormatado: new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            }));
    }, [vendasFiltradas]);

    const dadosFormaPagamento = useMemo(() => {
        const agrupado = {};
        vendasFiltradas.forEach(v => {
            // Prioriza o array de pagamentos (PDV moderno)
            const pagamentos = v.pagamentos || [];
            if (pagamentos.length > 0) {
                pagamentos.forEach(pag => {
                    const forma = pag.forma_pagamento || 'Não informado';
                    if (!agrupado[forma]) agrupado[forma] = 0;
                    agrupado[forma] += pag.valor || 0;
                });
            } else {
                // Fallback para campo legado
                const forma = v.forma_pagamento || 'Não informado';
                if (!agrupado[forma]) agrupado[forma] = 0;
                agrupado[forma] += v.valor_total || 0;
            }
        });
        return Object.entries(agrupado).map(([nome, valor]) => ({ nome, valor }));
    }, [vendasFiltradas]);

    const rankingVendedores = useMemo(() => {
        const agrupado = {};
        vendasFiltradas.forEach(v => {
            // Usa responsavel_nome (PDV) ou vendedor_nome (legado)
            const vendedor = v.responsavel_nome || v.vendedor_nome || 'Não informado';
            if (!agrupado[vendedor]) agrupado[vendedor] = { nome: vendedor, total: 0, qtd: 0 };
            agrupado[vendedor].total += v.valor_total || 0;
            agrupado[vendedor].qtd++;
        });
        return Object.values(agrupado)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [vendasFiltradas]);

    const rankingProdutos = useMemo(() => {
        const agrupado = {};
        vendasFiltradas.forEach(v => {
            (v.itens || []).forEach(item => {
                const nome = item.produto_nome || 'Produto';
                if (!agrupado[nome]) agrupado[nome] = { nome, qtd: 0, total: 0 };
                agrupado[nome].qtd += item.quantidade || 1;
                agrupado[nome].total += (item.quantidade || 1) * (item.preco_unitario || 0);
            });
        });
        return Object.values(agrupado)
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 10);
    }, [vendasFiltradas]);

    // Lojas disponíveis
    const lojas = useMemo(() => {
        const unique = [...new Set(vendas.map(v => v.loja).filter(Boolean))];
        return unique;
    }, [vendas]);

    const formatarMoeda = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const KPICard = ({ titulo, valor, icone: Icon, cor, variacao, subtitulo }) => (
        <Card className="relative overflow-hidden">
            <CardContent className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm text-gray-500">{titulo}</p>
                        <p className="text-2xl font-bold mt-1">{valor}</p>
                        {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
                    </div>
                    <div className={`p-3 rounded-xl bg-${cor}-100`}>
                        <Icon className={`w-6 h-6 text-${cor}-600`} />
                    </div>
                </div>
                {variacao !== undefined && (
                    <div className={`flex items-center gap-1 mt-3 text-sm ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variacao >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span>{Math.abs(variacao).toFixed(1)}% vs período anterior</span>
                    </div>
                )}
            </CardContent>
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-${cor}-500`} />
        </Card>
    );

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7" />
                        Dashboard BI
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Visão gerencial do negócio em tempo real
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={periodo} onValueChange={setPeriodo}>
                        <SelectTrigger className="w-[140px]">
                            <Calendar className="w-4 h-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="hoje">Hoje</SelectItem>
                            <SelectItem value="semana">Esta Semana</SelectItem>
                            <SelectItem value="mes">Este Mês</SelectItem>
                            <SelectItem value="ano">Este Ano</SelectItem>
                        </SelectContent>
                    </Select>
                    {lojas.length > 1 && (
                        <Select value={lojaFiltro} onValueChange={setLojaFiltro}>
                            <SelectTrigger className="w-[140px]">
                                <Store className="w-4 h-4 mr-2" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todas">Todas Lojas</SelectItem>
                                {lojas.map(loja => (
                                    <SelectItem key={loja} value={loja}>{loja}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button variant="outline" size="icon" onClick={() => refetchVendas()}>
                        <RefreshCw className={`w-4 h-4 ${loadingVendas ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* KPIs Principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard
                    titulo="Faturamento"
                    valor={formatarMoeda(kpis.faturamento)}
                    icone={DollarSign}
                    cor="green"
                    subtitulo={`${kpis.qtdVendas} vendas`}
                />
                <KPICard
                    titulo="Ticket Médio"
                    valor={formatarMoeda(kpis.ticketMedio)}
                    icone={ShoppingCart}
                    cor="blue"
                />
                <KPICard
                    titulo="Resultado"
                    valor={formatarMoeda(kpis.lucro)}
                    icone={kpis.lucro >= 0 ? TrendingUp : TrendingDown}
                    cor={kpis.lucro >= 0 ? "emerald" : "red"}
                    subtitulo={`Receitas: ${formatarMoeda(kpis.receitas)}`}
                />
                <KPICard
                    titulo="Entregas Hoje"
                    valor={`${kpis.entregasRealizadas}/${kpis.entregasRealizadas + kpis.entregasPendentes}`}
                    icone={Truck}
                    cor="purple"
                    subtitulo={`${kpis.entregasPendentes} pendentes`}
                />
            </div>

            {/* Gráficos Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendas por Dia */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Vendas por Dia
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={dadosVendasPorDia}>
                                <defs>
                                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="diaFormatado" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value) => [formatarMoeda(value), 'Total']}
                                    labelFormatter={(label) => `Dia: ${label}`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorVendas)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Formas de Pagamento */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PieChart className="w-5 h-5" />
                            Formas de Pagamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsPie>
                                <Pie
                                    data={dadosFormaPagamento}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ nome, percent }) => `${nome} (${(percent * 100).toFixed(0)}%)`}
                                    outerRadius={100}
                                    dataKey="valor"
                                >
                                    {dadosFormaPagamento.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatarMoeda(value)} />
                            </RechartsPie>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ranking Vendedores */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Award className="w-5 h-5 text-yellow-500" />
                            Top Vendedores
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead className="text-center">Vendas</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rankingVendedores.map((v, i) => (
                                    <TableRow key={v.nome}>
                                        <TableCell>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">{v.nome}</TableCell>
                                        <TableCell className="text-center">{v.qtd}</TableCell>
                                        <TableCell className="text-right font-bold text-green-600">
                                            {formatarMoeda(v.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Produtos Mais Vendidos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Produtos Mais Vendidos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-center">Qtd</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rankingProdutos.slice(0, 5).map((p) => (
                                    <TableRow key={p.nome}>
                                        <TableCell className="font-medium truncate max-w-[200px]">
                                            {p.nome}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline">{p.qtd}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatarMoeda(p.total)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Estoque Baixo */}
                {kpis.produtosAbaixoMinimo > 0 && (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-3 bg-orange-100 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="font-bold text-orange-800">Estoque Baixo</p>
                                <p className="text-sm text-orange-600">
                                    {kpis.produtosAbaixoMinimo} produtos abaixo do mínimo
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Valor em Estoque */}
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-bold text-blue-800">Valor em Estoque</p>
                            <p className="text-lg font-bold text-blue-600">
                                {formatarMoeda(kpis.valorEstoque)}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Novos Clientes */}
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="font-bold text-green-800">Clientes</p>
                            <p className="text-sm text-green-600">
                                +{kpis.novosClientes} novos | {kpis.totalClientes} total
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
