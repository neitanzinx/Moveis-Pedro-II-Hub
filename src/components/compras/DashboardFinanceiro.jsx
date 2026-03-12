import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    XCircle,
    Eye,
    Clock,
    DollarSign,
    User,
    FileText,
    AlertCircle,
    ArrowRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DashboardFinanceiro({ aprovacoes, onApprove, onReject, onView, onViewAll }) {

    const pendentes = useMemo(() => {
        return aprovacoes.filter(a => a.status === 'pendente')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [aprovacoes]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg border-none">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-amber-100 text-sm font-bold uppercase tracking-wider">Aguardando Sua Aprovação</p>
                                <h3 className="text-5xl font-black mt-2">{pendentes.length}</h3>
                                <p className="text-amber-100 text-xs mt-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Ação necessária para prosseguir com pedidos
                                </p>
                            </div>
                            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md">
                                <AlertCircle className="w-10 h-10 text-white" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-none shadow-sm flex flex-col justify-center p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-2xl">
                            <DollarSign className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total em Validação</p>
                            <h4 className="text-2xl font-bold text-gray-900">
                                R$ {pendentes.reduce((acc, curr) => acc + (curr.ordem?.valor_total || 0), 0).toLocaleString('pt-BR')}
                            </h4>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Fila de Aprovações */}
            <Card className="border-none shadow-md bg-white overflow-hidden">
                <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-6 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Fila de Prioridades
                        </CardTitle>
                        <CardDescription>Pedidos aguardando validação financeira</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700" onClick={onViewAll}>
                        Ver histórico completo <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-gray-100">
                        {pendentes.length > 0 ? (
                            pendentes.map((aprovacao) => (
                                <div key={aprovacao.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-start gap-4">
                                        <div className="hidden md:flex w-12 h-12 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900">OC {aprovacao.ordem?.numero_pedido || (aprovacao.ordem_compra_id?.substring(0, 8))}</h4>
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none text-[10px]">
                                                    {aprovacao.ordem?.fornecedor_nome || 'Fornecedor'}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                                <span className="flex items-center gap-1 font-medium text-green-600">
                                                    R$ {aprovacao.ordem?.valor_total?.toLocaleString('pt-BR')}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {aprovacao.ordem?.centro_custo?.nome || 'Vendedor'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Há {formatDistanceToNow(new Date(aprovacao.created_at), { locale: ptBR })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-9 px-4 border-gray-200 text-gray-600 hover:bg-gray-100"
                                            onClick={() => onView(aprovacao)}
                                        >
                                            <Eye className="w-4 h-4 mr-1" />
                                            Ver
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-9 px-4 bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none"
                                            onClick={() => onReject(aprovacao)}
                                        >
                                            <XCircle className="w-4 h-4 mr-1" />
                                            Rejeitar
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                            onClick={() => onApprove(aprovacao)}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-1" />
                                            Aprovar
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-12 text-center space-y-3">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                                </div>
                                <h4 className="font-bold text-gray-900">Tudo em dia!</h4>
                                <p className="text-gray-500 text-sm max-w-xs mx-auto">Não existem novas solicitações de aprovação pendentes no momento.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
