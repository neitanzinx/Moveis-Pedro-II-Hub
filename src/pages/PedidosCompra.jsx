import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Package, Plus, Search, FileText, Truck, CheckCircle, Clock, AlertTriangle,
    Eye, Edit, Trash2, Send, PackageCheck, Building2, LayoutDashboard,
    Tag, TrendingDown, Calendar, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/useConfirm";
import PedidoCompraModal from "@/components/estoque/PedidoCompraModal";
import RecebimentoPedido from "@/components/estoque/RecebimentoPedido";
import { differenceInDays, format, isBefore } from "date-fns";

import Fornecedores from "./Fornecedores";
import DashboardComprasTab from "@/components/compras/DashboardComprasTab";

export default function PedidosCompra() {
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState("todos");
    const [modalNovo, setModalNovo] = useState(false);
    const [modalEditar, setModalEditar] = useState(null);
    const [modalReceber, setModalReceber] = useState(null);
    const [modalDetalhes, setModalDetalhes] = useState(null);
    const [activeTab, setActiveTab] = useState("dashboard");

    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Buscar pedidos de compra
    const { data: pedidos = [], isLoading } = useQuery({
        queryKey: ['pedidos-compra'],
        queryFn: () => base44.entities.PedidoCompra.list('-created_at')
    });

    // Buscar fornecedores
    const { data: fornecedores = [] } = useQuery({
        queryKey: ['fornecedores'],
        queryFn: () => base44.entities.Fornecedor.list()
    });

    // Mutation para deletar
    const deletarPedido = useMutation({
        mutationFn: (id) => base44.entities.PedidoCompra.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
            toast.success('Pedido excluído');
        }
    });

    // Filtrar pedidos
    const pedidosFiltrados = pedidos.filter(p => {
        const matchBusca = !busca ||
            p.numero_pedido?.toLowerCase().includes(busca.toLowerCase()) ||
            p.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase());
        const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus;
        return matchBusca && matchStatus;
    });

    // Status badges
    const statusConfig = {
        'Rascunho': { cor: 'bg-gray-100 text-gray-800', icon: FileText },
        'Enviado': { cor: 'bg-blue-100 text-blue-800', icon: Send },
        'Confirmado': { cor: 'bg-purple-100 text-purple-800', icon: CheckCircle },
        'Parcialmente Recebido': { cor: 'bg-orange-100 text-orange-800', icon: PackageCheck },
        'Recebido': { cor: 'bg-green-100 text-green-800', icon: Truck },
        'Cancelado': { cor: 'bg-red-100 text-red-800', icon: AlertTriangle }
    };

    const urgenciaConfig = {
        'normal': { cor: '', label: '' },
        'urgente': { cor: 'bg-orange-100 text-orange-700', label: '⚡ Urgente' },
        'critico': { cor: 'bg-red-100 text-red-700', label: '🔥 Crítico' }
    };

    const handleExcluir = async (pedido) => {
        const confirmado = await confirm({
            title: 'Excluir Pedido',
            message: `Tem certeza que deseja excluir o pedido ${pedido.numero_pedido}?`,
            confirmText: 'Excluir',
            variant: 'destructive'
        });
        if (confirmado) {
            deletarPedido.mutate(pedido.id);
        }
    };

    const totalPorStatus = (status) => {
        if (status === 'todos') return pedidos.length;
        return pedidos.filter(p => p.status === status).length;
    };

    // Calcular dias restantes para entrega
    const getDiasEntrega = (dataPrevisao) => {
        if (!dataPrevisao) return null;
        const dias = differenceInDays(new Date(dataPrevisao), new Date());
        return dias;
    };

    const getCorDiasEntrega = (dias) => {
        if (dias === null) return 'text-gray-400';
        if (dias < 0) return 'text-red-600 font-bold';
        if (dias <= 2) return 'text-orange-600';
        if (dias <= 5) return 'text-yellow-600';
        return 'text-green-600';
    };

    // Navegação entre abas
    const handleNavigate = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <LayoutDashboard className="w-7 h-7 text-green-600" />
                            Setor de Compras
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Central de controle de compras, estoque e fornecedores
                        </p>
                    </div>
                    {activeTab === 'pedidos' && (
                        <Button onClick={() => setModalNovo(true)} className="gap-2 bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4" />
                            Novo Pedido
                        </Button>
                    )}
                </div>

                {/* Tabs principais */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full max-w-lg grid-cols-3 h-12">
                        <TabsTrigger value="dashboard" className="gap-2">
                            <LayoutDashboard className="w-4 h-4" />
                            <span className="hidden md:inline">Dashboard</span>
                        </TabsTrigger>
                        <TabsTrigger value="pedidos" className="gap-2">
                            <FileText className="w-4 h-4" />
                            <span className="hidden md:inline">Pedidos</span>
                            {totalPorStatus('todos') > 0 && (
                                <Badge variant="secondary" className="ml-1">{totalPorStatus('todos')}</Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="fornecedores" className="gap-2">
                            <Building2 className="w-4 h-4" />
                            <span className="hidden md:inline">Fornecedores</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab Dashboard */}
                    <TabsContent value="dashboard" className="mt-6">
                        <DashboardComprasTab onNavigate={handleNavigate} />
                    </TabsContent>

                    {/* Tab Pedidos */}
                    <TabsContent value="pedidos" className="space-y-6 mt-6">
                        {/* Cards de resumo */}
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
                                    className={`cursor-pointer transition-all hover:shadow-md ${filtroStatus === item.status ? `ring-2 ring-${item.cor}-500` : ''
                                        }`}
                                    onClick={() => setFiltroStatus(item.status)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <item.icon className={`w-8 h-8 text-${item.cor}-500`} />
                                            <span className="text-2xl font-bold">{totalPorStatus(item.status)}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">{item.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Filtros e busca */}
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

                        {/* Tabela de pedidos */}
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
                                                    Carregando...
                                                </TableCell>
                                            </TableRow>
                                        ) : pedidosFiltrados.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                                    Nenhum pedido encontrado
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            pedidosFiltrados.map((pedido) => {
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
                                                            ) : (
                                                                <Badge variant="outline">Tabela</Badge>
                                                            )}
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
                                                                    onClick={() => setModalDetalhes(pedido)}
                                                                    title="Ver detalhes"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>

                                                                {pedido.status === 'Rascunho' && (
                                                                    <>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => setModalEditar(pedido)}
                                                                            title="Editar"
                                                                        >
                                                                            <Edit className="w-4 h-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleExcluir(pedido)}
                                                                            title="Excluir"
                                                                            className="text-red-600 hover:text-red-700"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </Button>
                                                                    </>
                                                                )}

                                                                {['Enviado', 'Confirmado', 'Parcialmente Recebido'].includes(pedido.status) && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setModalReceber(pedido)}
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
                    </TabsContent>

                    {/* Tab Fornecedores */}
                    <TabsContent value="fornecedores" className="mt-6">
                        <Fornecedores />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Modal Novo Pedido */}
            {modalNovo && (
                <PedidoCompraModal
                    open={modalNovo}
                    onClose={() => setModalNovo(false)}
                    fornecedores={fornecedores}
                />
            )}

            {/* Modal Editar Pedido */}
            {modalEditar && (
                <PedidoCompraModal
                    open={!!modalEditar}
                    onClose={() => setModalEditar(null)}
                    pedido={modalEditar}
                    fornecedores={fornecedores}
                />
            )}

            {/* Modal Receber Pedido */}
            {modalReceber && (
                <RecebimentoPedido
                    open={!!modalReceber}
                    onClose={() => setModalReceber(null)}
                    pedido={modalReceber}
                />
            )}

            {/* Modal Detalhes */}
            <Dialog open={!!modalDetalhes} onOpenChange={() => setModalDetalhes(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Pedido {modalDetalhes?.numero_pedido}
                        </DialogTitle>
                    </DialogHeader>
                    {modalDetalhes && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500">Fornecedor</p>
                                    <p className="font-medium">{modalDetalhes.fornecedor_nome}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Status</p>
                                    <Badge className={statusConfig[modalDetalhes.status]?.cor}>
                                        {modalDetalhes.status}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Data do Pedido</p>
                                    <p className="font-medium">
                                        {modalDetalhes.data_pedido ? format(new Date(modalDetalhes.data_pedido), 'dd/MM/yyyy') : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Previsão de Entrega</p>
                                    <p className="font-medium">
                                        {modalDetalhes.data_previsao_entrega ? format(new Date(modalDetalhes.data_previsao_entrega), 'dd/MM/yyyy') : '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Info de promoção */}
                            {modalDetalhes.tipo_preco === 'promocional' && (
                                <Card className="bg-amber-50 border-amber-200">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                                            <Tag className="w-4 h-4" />
                                            Compra com Preço Promocional
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            {modalDetalhes.promocao_inicio && (
                                                <div>
                                                    <p className="text-gray-500">Início</p>
                                                    <p className="font-medium">{format(new Date(modalDetalhes.promocao_inicio), 'dd/MM/yyyy')}</p>
                                                </div>
                                            )}
                                            {modalDetalhes.promocao_fim && (
                                                <div>
                                                    <p className="text-gray-500">Fim</p>
                                                    <p className="font-medium">{format(new Date(modalDetalhes.promocao_fim), 'dd/MM/yyyy')}</p>
                                                </div>
                                            )}
                                            {modalDetalhes.economia_total > 0 && (
                                                <div>
                                                    <p className="text-gray-500">Economia</p>
                                                    <p className="font-bold text-green-600">
                                                        R$ {modalDetalhes.economia_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {modalDetalhes.promocao_observacao && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                📝 {modalDetalhes.promocao_observacao}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            <div>
                                <p className="text-sm text-gray-500 mb-2">Itens do Pedido</p>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produto</TableHead>
                                                <TableHead className="text-center">Qtd</TableHead>
                                                {modalDetalhes.tipo_preco === 'promocional' && (
                                                    <TableHead className="text-right">Preço Tabela</TableHead>
                                                )}
                                                <TableHead className="text-right">Preço Unit.</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(modalDetalhes.itens || []).map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{item.produto_nome}</TableCell>
                                                    <TableCell className="text-center">{item.quantidade_pedida}</TableCell>
                                                    {modalDetalhes.tipo_preco === 'promocional' && (
                                                        <TableCell className="text-right text-gray-500">
                                                            R$ {(item.preco_tabela || item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="text-right">
                                                        R$ {(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        R$ {((item.quantidade_pedida || 0) * (item.preco_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 border-t">
                                <span className="text-lg font-bold">Total do Pedido</span>
                                <span className="text-2xl font-bold text-green-600">
                                    R$ {(modalDetalhes.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            {modalDetalhes.observacoes && (
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm text-gray-500">Observações</p>
                                    <p className="mt-1">{modalDetalhes.observacoes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
