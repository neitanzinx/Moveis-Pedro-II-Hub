import React, { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    FileText, Send, CheckCircle, PackageCheck, Truck, AlertTriangle,
    Search, Eye, Edit, Trash2, Tag, TrendingDown, Building2, Clock
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function PedidosList({ onEdit, onView, onDelete, onReceber }) {
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("todos");

    // Configurações visuais
    const statusConfig = {
        'Rascunho': { cor: 'bg-gray-100 text-gray-800', icon: FileText },
        'Enviado': { cor: 'bg-blue-100 text-blue-800', icon: Send },
        'Confirmado': { cor: 'bg-purple-100 text-purple-800', icon: CheckCircle },
        'Em Conferência': { cor: 'bg-blue-600 text-white shadow-sm', icon: Clock },
        'Parcialmente Recebido': { cor: 'bg-orange-100 text-orange-800', icon: PackageCheck },
        'Recebido': { cor: 'bg-green-100 text-green-800', icon: Truck },
        'Cancelado': { cor: 'bg-red-100 text-red-800', icon: AlertTriangle }
    };

    const urgenciaConfig = {
        'normal': { cor: '', label: '' },
        'urgente': { cor: 'bg-orange-100 text-orange-700', label: '⚡ Urgente' },
        'critico': { cor: 'bg-red-100 text-red-700', label: '🔥 Crítico' }
    };

    // Query para contadores de status (lightweight)
    const { data: statusCounts = {} } = useQuery({
        queryKey: ['pedidos-compra-counts'],
        queryFn: async () => {
            // Busca apenas o campo status de todos os pedidos para contar
            // Se houver muitos pedidos, idealmente seria um RPC ou count server-side agrupado
            const { data } = await base44.entities.PedidoCompra.list('status'); // Assumindo que list suporta select se modificado, mas o padrão list traz tudo. 
            // Como list traz tudo, vamos usar diretamente o supabase via createHandler se possível? 
            // O createHandler.list traz tudo. Vamos assumir que não são milhões.
            // Se for pesado, o ideal seria adicionar um método .countByStatus() no handler.
            // Para manter simples e robusto por enquanto, vamos filtrar no front dessa lista completa (mas leve se fosse só status).
            // Porém o .list() atual traz SELECT *.
            // Melhor usar o .search com limit alto ou criar um método específico?
            // Vamos usar o que temos. O .list() traz tudo.

            // Refatoração segura: base44.entities.PedidoCompra.list() traz tudo.
            // Para não pesar, vamos assumir que o volume de pedidos é gerenciável (< 5000).

            const counts = {
                todos: data.length,
                'Rascunho': 0,
                'Enviado': 0,
                'Parcialmente Recebido': 0,
                'Recebido': 0,
                'Cancelado': 0,
                'Confirmado': 0
            };

            data.forEach(p => {
                if (counts[p.status] !== undefined) {
                    counts[p.status]++;
                }
            });

            return counts;
        }
    });

    // Query Paginada Principal
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading
    } = useInfiniteQuery({
        queryKey: ['pedidos-compra', busca, filtroStatus],
        queryFn: async ({ pageParam = 1 }) => {
            const filters = {};
            if (filtroStatus !== 'todos') {
                filters.status = filtroStatus;
            }

            return await base44.entities.PedidoCompra.search({
                page: pageParam,
                limit: 20, // Página menor para carregar rápido
                filters,
                search: busca,
                orderBy: '-created_at'
            });
        },
        getNextPageParam: (lastPage, allPages) => {
            const loadedItems = allPages.reduce((acc, page) => acc + page.data.length, 0);
            if (loadedItems < lastPage.count) {
                return allPages.length + 1;
            }
            return undefined;
        }
    });

    const pedidos = data?.pages.flatMap(page => page.data) || [];

    // Helpers de UI
    const getDiasEntrega = (dataPrevisao) => {
        if (!dataPrevisao) return null;
        return differenceInDays(new Date(dataPrevisao), new Date());
    };

    const getCorDiasEntrega = (dias) => {
        if (dias === null) return 'text-gray-400';
        if (dias < 0) return 'text-red-600 font-bold';
        if (dias <= 2) return 'text-orange-600';
        if (dias <= 5) return 'text-yellow-600';
        return 'text-green-600';
    };

    return (
        <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { status: 'todos', label: 'Todos', icon: FileText, cor: 'gray' },
                    { status: 'Rascunho', label: 'Rascunhos', icon: FileText, cor: 'gray' },
                    { status: 'Enviado', label: 'Enviados', icon: Send, cor: 'blue' },
                    { status: 'Parcialmente Recebido', label: 'Em Recebimento', icon: PackageCheck, cor: 'orange' },
                    { status: 'Recebido', label: 'Recebidos', icon: CheckCircle, cor: 'green' }
                ].map(item => (
                    <Card
                        key={item.status}
                        className={`cursor-pointer transition-all hover:shadow-md ${filtroStatus === item.status ? `ring-2 ring-${item.cor}-500` : ''}`}
                        onClick={() => setFiltroStatus(item.status)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <item.icon className={`w-8 h-8 text-${item.cor}-500`} />
                                <span className="text-2xl font-bold">{statusCounts[item.status] || 0}</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">{item.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filtros e Busca */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por número ou fornecedor..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filtrar por status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os status</SelectItem>
                                <SelectItem value="Rascunho">Rascunho</SelectItem>
                                <SelectItem value="Enviado">Enviado</SelectItem>
                                <SelectItem value="Confirmado">Confirmado</SelectItem>
                                <SelectItem value="Parcialmente Recebido">Parcialmente Recebido</SelectItem>
                                <SelectItem value="Recebido">Recebido</SelectItem>
                                <SelectItem value="Cancelado">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pedido</TableHead>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead>Previsão</TableHead>
                                <TableHead>Tipo Preço</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                                            Carregando...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : pedidos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                        Nenhum pedido encontrado
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pedidos.map((pedido) => {
                                    const statusInfo = statusConfig[pedido.status] || statusConfig['Rascunho'];
                                    const urgInfo = urgenciaConfig[pedido.urgencia] || urgenciaConfig['normal'];
                                    const diasEntrega = getDiasEntrega(pedido.data_previsao_entrega);
                                    const isAtrasado = diasEntrega !== null && diasEntrega < 0 && !['Recebido', 'Cancelado'].includes(pedido.status);

                                    return (
                                        <TableRow key={pedido.id} className={`hover:bg-gray-50 ${isAtrasado ? 'bg-red-50' : ''}`}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-blue-600">
                                                        {pedido.numero_pedido}
                                                    </span>
                                                    {urgInfo.label && (
                                                        <Badge className={urgInfo.cor + " text-xs"}>
                                                            {urgInfo.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                    {pedido.fornecedor_nome || 'Não informado'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {pedido.data_pedido ? format(new Date(pedido.data_pedido), 'dd/MM/yy') : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {pedido.data_previsao_entrega ? (
                                                    <div className="flex flex-col">
                                                        <span>{format(new Date(pedido.data_previsao_entrega), 'dd/MM/yy')}</span>
                                                        {!['Recebido', 'Cancelado'].includes(pedido.status) && (
                                                            <span className={`text-xs ${getCorDiasEntrega(diasEntrega)}`}>
                                                                {diasEntrega === 0 ? 'Hoje!' :
                                                                    diasEntrega > 0 ? `em ${diasEntrega}d` :
                                                                        `${Math.abs(diasEntrega)}d atrasado`}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {pedido.tipo_preco === 'promocional' ? (
                                                    <div className="flex flex-col">
                                                        <Badge className="bg-amber-100 text-amber-700 gap-1 w-fit">
                                                            <Tag className="w-3 h-3" />
                                                            Promocional
                                                        </Badge>
                                                        {pedido.economia_total > 0 && (
                                                            <span className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                                <TrendingDown className="w-3 h-3" />
                                                                -R$ {pedido.economia_total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                R$ {(pedido.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`${statusInfo.cor} gap-1`}>
                                                    <statusInfo.icon className="w-3 h-3" />
                                                    {pedido.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => onView && onView(pedido)}
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    {pedido.status === 'Rascunho' && (
                                                        <>
                                                            <Button variant="ghost" size="icon" onClick={() => onEdit && onEdit(pedido)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => onDelete && onDelete(pedido)} className="text-red-600">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {['Confirmado', 'Em Conferência', 'Parcialmente Recebido'].includes(pedido.status) && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => onReceber && onReceber(pedido)}
                                                            className="gap-1"
                                                        >
                                                            <PackageCheck className="w-4 h-4" />
                                                            Receber
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Load More Button */}
            {hasNextPage && (
                <div className="flex justify-center py-4">
                    <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full md:w-auto"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                                Carregando mais...
                            </>
                        ) : (
                            'Carregar mais pedidos'
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
