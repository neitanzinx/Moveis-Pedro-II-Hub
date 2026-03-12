import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertCircle,
    Clock,
    Truck,
    ChevronRight,
    LayoutDashboard,
    AlertTriangle,
    User,
    Building
} from "lucide-react";
import { format, isBefore, isToday, differenceInHours } from "date-fns";

export default function DashboardComprador({ pedidos, produtos, vendedores, onFilter, onViewKanban }) {
    const hoje = new Date();

    const stats = useMemo(() => {
        const naoFaturados = pedidos.filter(p => (p.status || '').toUpperCase() === 'NÃO FATURADO');

        const semResposta = pedidos.filter(p => {
            // Regra: Aprovado, sem devolutiva e há mais de 24h
            if ((p.status || '').toUpperCase() !== 'APROVADO') return false;
            if (p.devolutiva) return false;
            const horasDesdeEnvio = differenceInHours(hoje, new Date(p.updated_at || p.created_at));
            return horasDesdeEnvio > 24;
        });

        const chegandoHoje = pedidos.filter(p => {
            if (!p.data_previsao_entrega) return false;
            if (['Recebido', 'Cancelado'].includes(p.status)) return false;
            return isToday(new Date(p.data_previsao_entrega));
        });

        // Agrupar por vendedor
        const porVendedor = vendedores.map(v => {
            const ativos = pedidos.filter(p =>
                p.centro_custo_id === v.id &&
                !['Recebido', 'Cancelado'].includes(p.status)
            );

            const atrasados = ativos.filter(p => {
                if (!p.data_previsao_entrega) return false;
                return isBefore(new Date(p.data_previsao_entrega), hoje);
            });

            return {
                ...v,
                ativos: ativos.length,
                atrasados: atrasados.length
            };
        });

        return {
            naoFaturados,
            semResposta,
            chegandoHoje,
            porVendedor
        };
    }, [pedidos, vendedores, hoje]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Resumo do Dia */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-red-500 bg-white"
                    onClick={() => onFilter('status', 'NÃO FATURADO')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Não Faturados</p>
                                <h3 className="text-4xl font-bold text-gray-900">{stats.naoFaturados.length}</h3>
                                <Button variant="link" className="p-0 h-auto text-red-600 font-semibold flex items-center gap-1 group">
                                    Ver no Kanban <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                            <div className="p-3 bg-red-50 rounded-2xl">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-orange-500 bg-white"
                    onClick={() => onFilter('sem_resposta', true)}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sem resposta &gt;24h</p>
                                <h3 className="text-4xl font-bold text-gray-900">{stats.semResposta.length}</h3>
                                <Button variant="link" className="p-0 h-auto text-orange-600 font-semibold flex items-center gap-1 group">
                                    Ver Detalhes <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </div>
                            <div className="p-3 bg-orange-50 rounded-2xl">
                                <Clock className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className="cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500 bg-white"
                    onClick={() => onFilter('status', 'ENTREGA HOJE')}
                >
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Chegando hoje</p>
                                <h3 className="text-4xl font-bold text-gray-900">{stats.chegandoHoje.length}</h3>
                                <p className="text-xs text-blue-600 font-medium mt-2">Logística em alerta</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-2xl">
                                <Truck className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Por Vendedor */}
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                    <div>
                        <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <LayoutDashboard className="w-5 h-5 text-green-600" />
                            Por Vendedor / Canal
                        </CardTitle>
                        <CardDescription>Status das encomendas por origem</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-white border-gray-200 hover:bg-gray-50"
                        onClick={onViewKanban}
                    >
                        Ver Kanban completo
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.porVendedor.map((v) => (
                            <div
                                key={v.id}
                                className="group p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50 text-gray-400 group-hover:scale-110 transition-transform">
                                        {v.tipo === 'vendedor' ? <User className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 truncate">{v.nome}</h4>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] uppercase font-mono bg-gray-50 border-gray-200"
                                            style={{ color: v.cor, borderColor: `${v.cor}40` }}
                                        >
                                            {v.tipo}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 bg-blue-50/50 rounded-lg">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase">Ativos</p>
                                        <p className="text-2xl font-black text-blue-700">{v.ativos}</p>
                                    </div>
                                    <div className={`p-2 rounded-lg ${v.atrasados > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                                        <p className={`text-[10px] font-bold uppercase ${v.atrasados > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                            Atrasados
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <p className={`text-2xl font-black ${v.atrasados > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                                                {v.atrasados}
                                            </p>
                                            {v.atrasados > 0 && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
