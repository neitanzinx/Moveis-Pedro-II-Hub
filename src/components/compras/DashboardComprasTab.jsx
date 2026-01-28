import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Package, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle,
    DollarSign, ShoppingCart, Truck, Tag, Building2, Calendar, ArrowRight,
    PackageCheck, FileText, Loader2, BarChart3, PieChart
} from "lucide-react";
import { differenceInDays, format, isBefore, subMonths, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    ComposedChart,
    Line
} from "recharts";

export default function DashboardComprasTab({ onNavigate }) {
    // Buscar dados
    const { data: pedidos = [], isLoading: loadingPedidos } = useQuery({
        queryKey: ['pedidos-compra'],
        queryFn: () => base44.entities.PedidoCompra.list('-created_at')
    });

    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ['produtos-estoque'],
        queryFn: () => base44.entities.Produto.list()
    });

    const isLoading = loadingPedidos || loadingProdutos;

    // Calcular KPIs e Dados para Gráficos
    const dashboardData = useMemo(() => {
        const hoje = new Date();

        // 1. KPIs Básicos
        const pedidosAbertos = pedidos.filter(p => !['Recebido', 'Cancelado'].includes(p.status));
        const valorAberto = pedidosAbertos.reduce((sum, p) => sum + (p.valor_total || 0), 0);

        const aguardandoRecebimento = pedidos.filter(p =>
            ['Enviado', 'Confirmado', 'Parcialmente Recebido'].includes(p.status)
        );

        const pedidosAtrasados = pedidos.filter(p => {
            if (!p.data_previsao_entrega) return false;
            if (['Recebido', 'Cancelado'].includes(p.status)) return false;
            return isBefore(new Date(p.data_previsao_entrega), hoje);
        });

        const produtosAbaixoMinimo = produtos.filter(p => {
            if (!p.ativo) return false;
            const estoque = p.quantidade_estoque || 0;
            const minimo = p.estoque_minimo || 5;
            return estoque < minimo;
        });

        // Economia
        const pedidosPromocionaisMes = pedidos.filter(p => {
            if (!p.created_at) return false;
            if (p.tipo_preco !== 'promocional') return false;
            const criado = new Date(p.created_at);
            return criado.getMonth() === hoje.getMonth() && criado.getFullYear() === hoje.getFullYear();
        });
        const economiaMes = pedidosPromocionaisMes.reduce((sum, p) => sum + (p.economia_total || 0), 0);
        const economiaTotal = pedidos
            .filter(p => p.tipo_preco === 'promocional')
            .reduce((sum, p) => sum + (p.economia_total || 0), 0);

        // 2. Dados para Gráficos - Evolução de Compras (Últimos 6 meses)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(hoje, 5 - i);
            return {
                date: d,
                monthLabel: format(d, 'MMM/yy', { locale: ptBR }),
                totalCompras: 0,
                totalEconomia: 0,
                qtdPedidos: 0
            };
        });

        pedidos.forEach(pedido => {
            if (pedido.status === 'Cancelado' || !pedido.created_at) return;
            const dataPedido = new Date(pedido.created_at);

            last6Months.forEach(monthData => {
                if (isSameMonth(dataPedido, monthData.date)) {
                    monthData.totalCompras += (pedido.valor_total || 0);
                    monthData.totalEconomia += (pedido.economia_total || 0);
                    monthData.qtdPedidos += 1;
                }
            });
        });

        // 3. Gastos por Fornecedor (Top 5)
        const gastosPorFornecedor = {};
        pedidos.forEach(pedido => {
            if (pedido.status === 'Cancelado' || !pedido.fornecedor_nome) return;
            if (!gastosPorFornecedor[pedido.fornecedor_nome]) {
                gastosPorFornecedor[pedido.fornecedor_nome] = 0;
            }
            gastosPorFornecedor[pedido.fornecedor_nome] += (pedido.valor_total || 0);
        });

        const topFornecedores = Object.entries(gastosPorFornecedor)
            .map(([nome, valor]) => ({ name: nome, value: valor }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // 4. Pedidos Recentes
        const recentes = pedidos.slice(0, 5);

        return {
            kpis: {
                valorAberto,
                pedidosAbertosCount: pedidosAbertos.length,
                aguardandoRecebimentoCount: aguardandoRecebimento.length,
                pedidosAtrasadosCount: pedidosAtrasados.length,
                produtosAbaixoMinimoCount: produtosAbaixoMinimo.length,
                economiaMes,
                economiaTotal,
                pedidosPromocionaisCount: pedidosPromocionaisMes.length,
                listaPedidosAtrasados: pedidosAtrasados.slice(0, 5),
                listaProdutosRepor: produtosAbaixoMinimo.slice(0, 8)
            },
            charts: {
                evolution: last6Months,
                topSuppliers: topFornecedores
            },
            recentes
        };
    }, [pedidos, produtos]);

    const { kpis, charts, recentes } = dashboardData;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Em Aberto</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    R$ {(kpis.valorAberto / 1000).toFixed(1)}k
                                </h3>
                                <p className="text-xs text-blue-600 mt-1 font-medium">
                                    {kpis.pedidosAbertosCount} pedidos ativos
                                </p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <DollarSign className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">A receber</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    {kpis.aguardandoRecebimentoCount}
                                </h3>
                                <p className="text-xs text-purple-600 mt-1 font-medium">
                                    Pedidos a caminho
                                </p>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Truck className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Economia (Mês)</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    R$ {kpis.economiaMes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                </h3>
                                <p className="text-xs text-green-600 mt-1 font-medium">
                                    {kpis.pedidosPromocionaisCount} compras promo
                                </p>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <TrendingDown className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Reposição</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    {kpis.produtosAbaixoMinimoCount}
                                </h3>
                                <p className="text-xs text-orange-600 mt-1 font-medium">
                                    Itens críticos
                                </p>
                            </div>
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Column 1 & 2: Charts */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Evolution Chart */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <BarChart3 className="w-5 h-5 text-gray-500" />
                                Evolução de Compras
                            </CardTitle>
                            <CardDescription>Gastos e Economia nos últimos 6 meses</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={charts.evolution}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="monthLabel"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                            tickFormatter={(value) => `R$${value / 1000}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar
                                            dataKey="totalCompras"
                                            name="Total Comprado"
                                            fill="#3B82F6"
                                            radius={[4, 4, 0, 0]}
                                            barSize={30}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="totalEconomia"
                                            name="Economia Gerada"
                                            stroke="#10B981"
                                            strokeWidth={2}
                                            dot={{ r: 4, fill: "#10B981" }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pending Actions / Lists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Late Orders */}
                        <Card className="shadow-sm border-red-100">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-red-700 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Entregas Atrasadas
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {kpis.listaPedidosAtrasados.length > 0 ? (
                                    <div className="space-y-3">
                                        {kpis.listaPedidosAtrasados.map(p => (
                                            <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-red-50 rounded-md border border-red-100">
                                                <div>
                                                    <span className="font-bold text-gray-700 block">{p.numero_pedido}</span>
                                                    <span className="text-xs text-red-600">{p.fornecedor_nome}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-red-700 font-medium block">
                                                        {format(new Date(p.data_previsao_entrega), 'dd/MM')}
                                                    </span>
                                                    <span className="text-xs text-red-500">Atrasado</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500 text-sm">
                                        Nenhum atraso registrado 🎉
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Top Suppliers Chart/List */}
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base text-gray-700 flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Top Fornecedores
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {charts.topSuppliers.map((fornecedor, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="w-6 h-6 flex justify-center items-center p-0 rounded-full text-xs">
                                                    {idx + 1}
                                                </Badge>
                                                <span className="truncate max-w-[120px]" title={fornecedor.name}>
                                                    {fornecedor.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${(fornecedor.value / charts.topSuppliers[0].value) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500 w-16 text-right">
                                                    {(fornecedor.value / 1000).toFixed(1)}k
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {charts.topSuppliers.length === 0 && (
                                        <p className="text-center text-gray-400 text-sm py-4">Sem dados suficientes</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Column 3: Recent Activity & Actions */}
                <div className="space-y-6">
                    {/* Quick Stats - Product Replacement */}
                    <Card className="bg-orange-50 border-orange-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-orange-800 flex items-center gap-2">
                                <Package className="w-4 h-4" />
                                Reposição Urgente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mb-4">
                                {kpis.listaProdutosRepor.slice(0, 5).map(prod => (
                                    <div key={prod.id} className="flex justify-between items-center text-sm border-b border-orange-200/50 pb-2 last:border-0 last:pb-0">
                                        <span className="truncate flex-1 pr-2" title={prod.nome}>{prod.nome}</span>
                                        <Badge variant="destructive" className="text-[10px] h-5">
                                            {prod.quantidade_estoque} un
                                        </Badge>
                                    </div>
                                ))}
                                {kpis.produtosAbaixoMinimoCount === 0 && (
                                    <p className="text-sm text-orange-600/70 text-center py-2">
                                        Estoque saudável
                                    </p>
                                )}
                            </div>
                            <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => onNavigate?.('pedidos')}>
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Criar Pedido
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Recent Orders Feed */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Últimos Pedidos</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative border-l border-gray-200 ml-3 space-y-6">
                                {recentes.map((pedido) => (
                                    <div key={pedido.id} className="ml-6 relative">
                                        <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-900">
                                                {pedido.fornecedor_nome}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                                                {pedido.numero_pedido} • {format(new Date(pedido.created_at), 'dd/MM HH:mm')}
                                            </span>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                                    {pedido.status}
                                                </Badge>
                                                <span className="text-xs font-medium text-gray-700">
                                                    R$ {pedido.valor_total?.toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Button variant="link" size="sm" className="w-full mt-4 text-blue-600" onClick={() => onNavigate?.('pedidos')}>
                                Ver todos os pedidos
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
