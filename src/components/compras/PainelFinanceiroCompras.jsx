import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { comprasFinanceiroService } from "@/services/comprasFinanceiroService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    DollarSign, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2,
    Wallet, Factory, PackageCheck, Clock, CreditCard, ArrowRight,
    Loader2, ChevronDown, ChevronUp, XCircle, BarChart3,
    Building2, Receipt, Target, Gauge
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ---------- Gauge SVG Component ----------
function BreakEvenGauge({ percent, label }) {
    const clampedPercent = Math.min(percent, 150);
    const angle = (clampedPercent / 150) * 180;
    const radians = (angle - 180) * (Math.PI / 180);
    const x = 50 + 40 * Math.cos(radians);
    const y = 50 + 40 * Math.sin(radians);

    let color = '#10B981'; // verde
    if (percent >= 100) color = '#EF4444'; // vermelho
    else if (percent >= 70) color = '#F59E0B'; // amarelo

    const circumference = Math.PI * 40; // metade do círculo
    const dashLength = (clampedPercent / 150) * circumference;

    return (
        <div className="flex flex-col items-center">
            <svg viewBox="0 0 100 60" className="w-36 h-20">
                {/* Background arc */}
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                {/* Filled arc */}
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${dashLength} ${circumference}`}
                    className="transition-all duration-1000 ease-out"
                />
                {/* Needle dot */}
                <circle cx={x} cy={y} r="3" fill={color} className="transition-all duration-1000 ease-out" />
                {/* Center percent text */}
                <text x="50" y="48" textAnchor="middle" className="text-xs font-bold" fill={color} fontSize="12">
                    {percent}%
                </text>
            </svg>
            <span className="text-xs text-gray-500 mt-1">{label}</span>
        </div>
    );
}

// ---------- Capacidade Badge ----------
function CapacidadeBadge({ nivel }) {
    const config = {
        alta: { color: 'bg-green-100 text-green-800 border-green-200', label: '✅ Capacidade Alta', icon: CheckCircle2 },
        atencao: { color: 'bg-amber-100 text-amber-800 border-amber-200', label: '⚠️ Atenção', icon: AlertTriangle },
        critica: { color: 'bg-red-100 text-red-800 border-red-200', label: '🚫 Sem Capacidade', icon: XCircle }
    };
    const c = config[nivel] || config.atencao;
    return <Badge className={`${c.color} border px-3 py-1 text-sm font-semibold`}>{c.label}</Badge>;
}

// ---------- MAIN COMPONENT ----------
export default function PainelFinanceiroCompras() {
    const queryClient = useQueryClient();
    const [filtroStatus, setFiltroStatus] = useState('todos');
    const [expandedFornecedor, setExpandedFornecedor] = useState(null);

    // --- Data Queries ---
    const { data: capacidade, isLoading: loadCap } = useQuery({
        queryKey: ['compras-capacidade'],
        queryFn: () => comprasFinanceiroService.getCapacidadeCompra(),
        refetchInterval: 60000
    });

    const { data: endividamentoFornecedores = [], isLoading: loadEnd } = useQuery({
        queryKey: ['compras-endividamento-fornecedor'],
        queryFn: () => comprasFinanceiroService.getEndividamentoPorFornecedor()
    });

    const { data: pedidosFase, isLoading: loadFase } = useQuery({
        queryKey: ['compras-pedidos-fase'],
        queryFn: () => comprasFinanceiroService.getPedidosPorFase()
    });

    const { data: contasPagar = [], isLoading: loadContas } = useQuery({
        queryKey: ['compras-contas-pagar'],
        queryFn: () => comprasFinanceiroService.getContasPagar()
    });

    // --- Mutations ---
    const marcarPago = useMutation({
        mutationFn: (id) => comprasFinanceiroService.marcarComoPago(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['compras-contas-pagar'] });
            queryClient.invalidateQueries({ queryKey: ['compras-capacidade'] });
            queryClient.invalidateQueries({ queryKey: ['compras-endividamento-fornecedor'] });
            toast.success('Compromisso marcado como pago');
        },
        onError: () => toast.error('Erro ao marcar como pago')
    });

    // --- Derived data ---
    const contasFiltradas = useMemo(() => {
        if (filtroStatus === 'todos') return contasPagar;
        return contasPagar.filter(c => c.status === filtroStatus);
    }, [contasPagar, filtroStatus]);

    const isLoading = loadCap || loadEnd || loadFase || loadContas;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
        );
    }

    const be = capacidade?.break_even || {};
    const ge = capacidade?.endividamento || {};
    const { emProducao = [], recebidos = [] } = pedidosFase || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* ========== KPI CARDS ROW ========== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Endividamento Total */}
                <Card className="bg-white border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Dívida Total</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    R$ {(ge.total_pendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </h3>
                                <p className="text-xs text-red-600 mt-1 font-medium">
                                    {ge.total_vencido > 0
                                        ? `R$ ${ge.total_vencido.toLocaleString('pt-BR')} vencido`
                                        : 'Nada vencido ✓'
                                    }
                                </p>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg">
                                <DollarSign className="w-5 h-5 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Pago este mês */}
                <Card className="bg-white border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Pago (Mês)</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">
                                    R$ {(ge.total_pago_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </h3>
                                <p className="text-xs text-green-600 mt-1 font-medium">
                                    Compromissos quitados
                                </p>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Break-Even Gauge */}
                <Card className="bg-white border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-500">Break-Even</p>
                                <BreakEvenGauge percent={be.break_even_percent || 0} label="Compromissos / Receita" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Capacidade de Compra */}
                <Card className={`bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow ${capacidade?.nivel === 'alta' ? 'border-l-green-500' :
                        capacidade?.nivel === 'atencao' ? 'border-l-amber-500' : 'border-l-red-500'
                    }`}>
                    <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium text-gray-500">Capacidade de Compra</p>
                            <CapacidadeBadge nivel={capacidade?.nivel || 'atencao'} />
                            <p className="text-xs text-gray-500 mt-1">
                                Saldo livre: R$ {(capacidade?.capacidade_valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ========== MAIN CONTENT GRID ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Column 1-2: Endividamento por Fornecedor + Contas */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Endividamento por Fornecedor */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Building2 className="w-5 h-5 text-gray-500" />
                                Endividamento por Fornecedor
                            </CardTitle>
                            <CardDescription>Saldo devedor detalhado</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {endividamentoFornecedores.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p>Nenhum compromisso em aberto</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {endividamentoFornecedores.map((f, idx) => {
                                        const maxVal = endividamentoFornecedores[0]?.total_pendente || 1;
                                        const pct = (f.total_pendente / maxVal) * 100;
                                        const isExpanded = expandedFornecedor === idx;

                                        return (
                                            <div key={idx} className="border rounded-lg overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => setExpandedFornecedor(isExpanded ? null : idx)}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Badge variant="outline" className="w-7 h-7 flex justify-center items-center p-0 rounded-full text-xs shrink-0">
                                                            {idx + 1}
                                                        </Badge>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-medium text-sm text-gray-800 truncate block">
                                                                {f.fornecedor_nome}
                                                            </span>
                                                            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                                                    style={{
                                                                        width: `${pct}%`,
                                                                        backgroundColor: f.total_vencido > 0 ? '#EF4444' : '#3B82F6'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 ml-3 shrink-0">
                                                        <div className="text-right">
                                                            <span className="text-sm font-bold text-gray-800 block">
                                                                R$ {f.total_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            {f.total_vencido > 0 && (
                                                                <span className="text-[10px] text-red-600 font-medium">
                                                                    {f.total_vencido.toLocaleString('pt-BR')} vencido
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="border-t bg-gray-50 px-4 py-3 space-y-1 text-sm animate-in slide-in-from-top-1 duration-200">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Títulos em aberto:</span>
                                                            <span className="font-medium">{f.qtd_titulos}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Próximo vencimento:</span>
                                                            <span className="font-medium">
                                                                {f.proximo_vencimento ? format(new Date(f.proximo_vencimento + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-500">Total vencido:</span>
                                                            <span className={`font-medium ${f.total_vencido > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                R$ {f.total_vencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Contas a Pagar */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Receipt className="w-5 h-5 text-gray-500" />
                                    Contas a Pagar
                                </CardTitle>
                                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                                    <SelectTrigger className="w-36 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="todos">Todos</SelectItem>
                                        <SelectItem value="pendente">Pendentes</SelectItem>
                                        <SelectItem value="vencido">Vencidos</SelectItem>
                                        <SelectItem value="pago">Pagos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {contasFiltradas.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p>Nenhum compromisso encontrado</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                    {contasFiltradas.map(conta => {
                                        const hoje = new Date().toISOString().split('T')[0];
                                        const isVencido = conta.status === 'pendente' && conta.data_vencimento < hoje;
                                        const diasVencimento = differenceInDays(
                                            new Date(conta.data_vencimento + 'T12:00:00'),
                                            new Date()
                                        );

                                        return (
                                            <div
                                                key={conta.id}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${conta.status === 'pago'
                                                        ? 'bg-green-50/50 border-green-100'
                                                        : isVencido
                                                            ? 'bg-red-50 border-red-200 animate-pulse'
                                                            : 'bg-white border-gray-100 hover:border-gray-200'
                                                    }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm text-gray-800 truncate">
                                                            {conta.fornecedor_nome}
                                                        </span>
                                                        {conta.total_parcelas > 1 && (
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                                                                {conta.numero_parcela}/{conta.total_parcelas}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                        <CreditCard className="w-3 h-3" />
                                                        <span>{conta.tipo?.toUpperCase()}</span>
                                                        <span>•</span>
                                                        <span>{conta.numero_documento || '-'}</span>
                                                        {conta.ordem?.numero_pedido && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-blue-500">OC {conta.ordem.numero_pedido}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0 ml-3">
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-gray-800 block">
                                                            R$ {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <span className={`text-[10px] font-medium block ${conta.status === 'pago' ? 'text-green-600' :
                                                                isVencido ? 'text-red-600' :
                                                                    diasVencimento <= 7 ? 'text-amber-600' : 'text-gray-500'
                                                            }`}>
                                                            {conta.status === 'pago'
                                                                ? `Pago ${conta.data_pagamento ? format(new Date(conta.data_pagamento + 'T12:00:00'), 'dd/MM') : ''}`
                                                                : isVencido
                                                                    ? `${Math.abs(diasVencimento)}d atraso`
                                                                    : `Vence ${format(new Date(conta.data_vencimento + 'T12:00:00'), 'dd/MM')}`
                                                            }
                                                        </span>
                                                    </div>
                                                    {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                                                            onClick={() => marcarPago.mutate(conta.id)}
                                                            disabled={marcarPago.isPending}
                                                        >
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            Pagar
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Column 3: Pipeline de Pedidos */}
                <div className="space-y-6">

                    {/* Projeção de Vencimentos */}
                    <Card className="bg-gradient-to-br from-slate-50 to-white shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-gray-700 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                Projeção de Vencimentos
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[
                                    { label: 'Próximos 30 dias', valor: ge.total_a_vencer_30d || 0, color: 'text-red-600' },
                                    { label: '30–60 dias', valor: ge.total_a_vencer_60d || 0, color: 'text-amber-600' },
                                    { label: '60–90 dias', valor: ge.total_a_vencer_90d || 0, color: 'text-blue-600' }
                                ].map((p, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">{p.label}</span>
                                        <span className={`font-bold ${p.color}`}>
                                            R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pedidos em Produção */}
                    <Card className="shadow-sm border-blue-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-blue-700 flex items-center gap-2">
                                <Factory className="w-4 h-4" />
                                Em Produção
                                <Badge variant="secondary" className="ml-auto text-xs">{emProducao.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {emProducao.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido em produção</p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                    {emProducao.slice(0, 10).map(p => (
                                        <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-blue-50/50 rounded-md border border-blue-50">
                                            <div>
                                                <span className="font-bold text-gray-700 block">{p.numero_pedido}</span>
                                                <span className="text-xs text-blue-600">{p.fornecedor_nome}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-medium text-gray-700 block">
                                                    R$ {(p.valor_total || 0).toLocaleString('pt-BR')}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{p.status}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                    {emProducao.length > 10 && (
                                        <p className="text-xs text-center text-gray-400 mt-2">
                                            +{emProducao.length - 10} pedidos
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pedidos Recebidos */}
                    <Card className="shadow-sm border-green-100">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base text-green-700 flex items-center gap-2">
                                <PackageCheck className="w-4 h-4" />
                                Recebidos
                                <Badge variant="secondary" className="ml-auto text-xs">{recebidos.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {recebidos.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">Nenhum pedido recebido recentemente</p>
                            ) : (
                                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                                    {recebidos.slice(0, 10).map(p => (
                                        <div key={p.id} className="flex items-center justify-between text-sm p-2 bg-green-50/50 rounded-md border border-green-50">
                                            <div>
                                                <span className="font-bold text-gray-700 block">{p.numero_pedido}</span>
                                                <span className="text-xs text-green-600">{p.fornecedor_nome}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-sm font-medium text-gray-700 block">
                                                    R$ {(p.valor_total || 0).toLocaleString('pt-BR')}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{p.forma_pagamento || 'boleto'}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                    {recebidos.length > 10 && (
                                        <p className="text-xs text-center text-gray-400 mt-2">
                                            +{recebidos.length - 10} pedidos
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Resumo Rápido */}
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <CardContent className="p-4">
                            <div className="text-center space-y-2">
                                <Gauge className="w-6 h-6 mx-auto text-green-600" />
                                <p className="text-xs text-gray-500">Receita do mês</p>
                                <p className="text-lg font-bold text-gray-800">
                                    R$ {(be.receita_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <div className="border-t border-green-200 pt-2 mt-2 text-xs text-gray-500">
                                    Compromissos mês: R$ {(be.compromissos_mes || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
